export interface Env {
	API_KEY?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const API_KEY = env.API_KEY;

		function processData(values: string[][]) {
			const commonHeaders = ['NAMA', 'PARTI', 'NEGERI/WP', 'KAWASAN', 'TEMPAT DUDUK', 'ROBLOX NAME', 'STATE/WP', 'AREA', 'SEAT', 'MEMBER'];

			return values
				.filter((row) => !isHeaderRow(row, commonHeaders))
				.filter((row) => row.length > 0)
				.map((row) => createMemberObject(row))
				.filter((member) => member !== null);
		}

		function isHeaderRow(row: string[], headers: string[]) {
			return row.some((cell) => headers.includes(cell.toUpperCase()));
		}

		function createMemberObject(row: string[]) {
			let [robloxName, parti, negeri, kawasan, tempatDuduk, cabinetRole, dewanRole] = row;
			robloxName = robloxName?.trim().split(' ')[0];

			// Separating main party and sub-party
			const [mainParty, subParty] = parti?.includes('(') ? parti.split(/\s*\(/) : [parti, ''];
			const cleanedSubParty = subParty?.replace(/\)/g, '').trim();

			return {
				robloxName,
				parti: mainParty?.trim(),
				subparti: cleanedSubParty !== '' ? cleanedSubParty?.trim() : undefined,
				negeri: negeri?.trim(),
				kawasanCode: kawasan?.match(/^\w+/)?.[0].trim(),
				kawasanName: kawasan?.match(/\s(.+)$/)?.[1].trim(),
				tempatDuduk: tempatDuduk?.trim(),
				cabinetRole,
				dewanRole,
			};
		}

		async function fetchRetry(url: string, numRetries: number) {
			for (let i = 0; i < numRetries; i++) {
				const response = await fetch(url);
				if (response.ok) return response;
				await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait for 15 seconds
			}
			return new Response(null, { status: 408 }); // Request Timeout
		}

		async function getUserIds(usernames: string[]) {
			const response = await fetch(`https://users.roblox.com/v1/usernames/users`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ usernames: usernames, excludeBannedUsers: true }),
			});

			if (!response.ok) {
				console.error('Failed to fetch user IDs');
				return [];
			}

			const data = (await response.json()) as any;
			console.log(data);
			return data.data.map((user: any) => ({ requestedUsername: user.requestedUsername, username: user.name, id: user.id }));
		}

		function cleanData(member: { [k: string]: string | undefined }) {
			// Filters out any key-value pairs where the value is an empty string
			const keys = Object.keys(member);
			const cleaned: { [k: string]: string | undefined } = {};
			for (let key of keys) {
				if (member[key] !== '') {
					cleaned[key] = member[key];
				}
			}
			return cleaned;
		}

		const url =
			'https://sheets.googleapis.com/v4/spreadsheets/15SrsEb7Bc7pYt5AnTOMpb79z80gCIC-_RCrAOpFUwd4/values/DR!F9:L81?alt=json&key=' + API_KEY;
		let response = await fetchRetry(url, 5);

		if (!response.ok) {
			return new Response('Unable to fetch Parliament data!', { status: 500 });
		}

		const data = (await response.json()) as any;
		console.log(data);
		const members = processData(data.values);

		members.sort((a, b) => {
			const aCode = a.kawasanCode;
			const bCode = b.kawasanCode;
			if (aCode && bCode) {
				return parseInt(aCode.substring(1)) - parseInt(bCode.substring(1));
			}
			return 0;
		});

		const usernames = members.map((member) => member.robloxName);
		const userIds = await getUserIds(usernames); // Fetch user IDs from Roblox API

		// Map user IDs back to members data
		const memberDetails = members.map((member) => {
			const user = userIds.find((user: any) => user.requestedUsername === member.robloxName);
			if (user) {
				return { ...member, userId: user.id, username: user.username, robloxName: undefined };
			}
			return { ...member };
		});

		const cleanedData = memberDetails.map(cleanData); // Clean data to remove empty strings

		return new Response(JSON.stringify(cleanedData), {
			headers: { 'Content-Type': 'application/json' },
		});
	},
};
