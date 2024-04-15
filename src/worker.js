export default {
  async fetch(request, env, ctx) {
    const API_KEY = env.API_KEY;

    function processData(values) {
      const commonHeaders = [
        "NAMA", "PARTI", "NEGERI/WP", "KAWASAN", "TEMPAT DUDUK",
        "ROBLOX NAME", "STATE/WP", "AREA", "SEAT", "MEMBER"
      ];
    
      return values.filter(row => !isHeaderRow(row, commonHeaders))
                   .map(row => createMemberObject(row))
                   .filter(member => member !== null);
    }
    
    function isHeaderRow(row, headers) {
      return row.some(cell => headers.includes(cell.toUpperCase()));
    }
    
    function createMemberObject(row) {
      let [robloxName, parti, negeri, kawasan, tempatDuduk] = row;
      robloxName = robloxName.trim().split(" ")[0];
      
      return {
        robloxName,
        parti: parti.trim(),
        negeri: negeri.trim(),
        kawasanCode: kawasan.match(/^\w+/)[0].trim(),
        kawasanName: kawasan.match(/\s(.+)$/)[1].trim(),
        tempatDuduk: tempatDuduk.trim()
      };
    }
    
    async function fetchRetry(url, numRetries) {
      for (let i = 0; i < numRetries; i++) {
        const response = await fetch(url);
        if (response.ok) return response;
        await new Promise(resolve => setTimeout(resolve, 15000));  // Wait for 15 seconds
      }
      return new Response(null, { status: 408 });  // Request Timeout
    }
    
    async function getUserIds(usernames) {
      const response = await fetch(`https://users.roblox.com/v1/usernames/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({usernames: usernames, excludeBannedUsers: true})
      });
    
      if (!response.ok) {
        console.error('Failed to fetch user IDs');
        return [];
      }
    
      const data = await response.json();
      return data.data.map(user => ({ username: user.name, id: user.id }));
    }

    const url = "https://sheets.googleapis.com/v4/spreadsheets/15SrsEb7Bc7pYt5AnTOMpb79z80gCIC-_RCrAOpFUwd4/values/DR!F9:J81?alt=json&key=" + API_KEY;
      let response = await fetchRetry(url, 5);
      
      if (!response.ok) {
        return new Response("Unable to fetch Parliament data!", { status: 500 });
      }
      
      const data = await response.json();
      console.log(data)
      const members = processData(data.values);
      
      return new Response(JSON.stringify(members), { 
        headers: { 'Content-Type': 'application/json' }
      });
  }
}