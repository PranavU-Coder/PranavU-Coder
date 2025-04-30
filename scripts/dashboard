const fs = require('fs');
const path = require('path');
const axios = require('axios');

// You'll need to install axios: npm install axios
// This script can be run locally or as part of your GitHub Actions

async function fetchGitHubStats(username, token) {
  try {
    const headers = token ? { Authorization: `token ${token}` } : {};
    
    // Get user data
    const userResponse = await axios.get(`https://api.github.com/users/${username}`, { headers });
    
    // Get repositories
    const reposResponse = await axios.get(`https://api.github.com/users/${username}/repos?per_page=100`, { headers });
    const repos = reposResponse.data;
    
    // Calculate stats
    let totalStars = 0;
    let languages = {};
    let commitCount = 0;
    let prCount = 0;
    let issueCount = 0;
    let contributedRepos = 0;
    
    // Process each repository
    for (const repo of repos) {
      totalStars += repo.stargazers_count;
      
      // Get language data for each repo
      const langResponse = await axios.get(repo.languages_url, { headers });
      const repoLanguages = langResponse.data;
      
      // Merge language data
      for (const [lang, bytes] of Object.entries(repoLanguages)) {
        if (languages[lang]) {
          languages[lang] += bytes;
        } else {
          languages[lang] = bytes;
        }
      }
      
      // Get commit data (limited to authenticated requests for better rate limits)
      if (token) {
        try {
          const commitsResponse = await axios.get(
            `https://api.github.com/repos/${repo.full_name}/commits?author=${username}&per_page=100`, 
            { headers }
          );
          commitCount += commitsResponse.data.length;
        } catch (error) {
          console.log(`Could not fetch commits for ${repo.full_name}: ${error.message}`);
        }
      }
    }
    
    // Get PR and Issue counts if token is provided
    if (token) {
      const prsResponse = await axios.get(
        `https://api.github.com/search/issues?q=author:${username}+type:pr`, 
        { headers }
      );
      prCount = prsResponse.data.total_count;
      
      const issuesResponse = await axios.get(
        `https://api.github.com/search/issues?q=author:${username}+type:issue`, 
        { headers }
      );
      issueCount = issuesResponse.data.total_count;
      
      // Get contributed repos (repos user has contributed to but doesn't own)
      const contributedResponse = await axios.get(
        `https://api.github.com/search/repositories?q=contributor:${username}+-user:${username}`, 
        { headers }
      );
      contributedRepos = contributedResponse.data.total_count;
    }
    
    // Sort languages by bytes
    const sortedLanguages = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
    
    // Create stats object
    const stats = {
      username: userResponse.data.login,
      name: userResponse.data.name,
      avatar_url: userResponse.data.avatar_url,
      html_url: userResponse.data.html_url,
      public_repos: userResponse.data.public_repos,
      total_stars: totalStars,
      total_commits: commitCount,
      total_prs: prCount,
      total_issues: issueCount,
      contributed_repos: contributedRepos,
      languages: sortedLanguages,
      updated_at: new Date().toISOString()
    };
    
    return stats;
  } catch (error) {
    console.error('Error fetching GitHub stats:', error.message);
    throw error;
  }
}

async function main() {
  const username = process.env.GITHUB_USERNAME || 'PranavU-Coder';
  const token = process.env.GITHUB_TOKEN;  // Personal access token for better rate limits
  
  try {
    const stats = await fetchGitHubStats(username, token);
    
    // Save to JSON file
    fs.writeFileSync(path.join(__dirname, 'stats.json'), JSON.stringify(stats, null, 2));
    console.log('GitHub stats saved to stats.json');
    
    // Update README if needed
    updateReadme(stats);
  } catch (error) {
    console.error('Failed to generate GitHub stats:', error);
    process.exit(1);
  }
}

function updateReadme(stats) {
  const readmePath = path.join(__dirname, 'README.md');
  
  // Check if README exists
  if (!fs.existsSync(readmePath)) {
    createDefaultReadme(stats);
    return;
  }
  
  let readme = fs.readFileSync(readmePath, 'utf8');
  
  // Create language table
  let languageTable = '| Language | Size |\n| -------- | ---- |\n';
  
  if (Object.keys(stats.languages).length === 0) {
    languageTable += '| No languages detected | - |\n';
  } else {
    for (const [language, bytes] of Object.entries(stats.languages)) {
      const sizeKB = Math.floor(bytes / 1024);
      languageTable += `| ${language} | ${sizeKB}KB |\n`;
    }
  }
  
  // Create stats section
  const statsSection = `
## GitHub Stats

- **Total Repositories:** ${stats.public_repos}
- **Total Stars:** ${stats.total_stars}
- **Total Commits:** ${stats.total_commits}
- **Total PRs:** ${stats.total_prs}
- **Total Issues:** ${stats.total_issues}
- **Contributed to:** ${stats.contributed_repos} repositories
- **Last Updated:** ${new Date(stats.updated_at).toLocaleString()}
`;

  // Check if markers exist, if not add them
  if (!readme.includes('<!-- LANGUAGES_START -->')) {
    readme += '\n## Languages\n<!-- LANGUAGES_START -->\n<!-- LANGUAGES_END -->\n';
  }
  
  if (!readme.includes('<!-- STATS_START -->')) {
    readme += '\n<!-- STATS_START -->\n<!-- STATS_END -->\n';
  }
  
  // Update language section
  readme = readme.replace(
    /<!-- LANGUAGES_START -->[\s\S]*?<!-- LANGUAGES_END -->/,
    `<!-- LANGUAGES_START -->\n${languageTable}<!-- LANGUAGES_END -->`
  );
  
  // Update stats section
  readme = readme.replace(
    /<!-- STATS_START -->[\s\S]*?<!-- STATS_END -->/,
    `<!-- STATS_START -->${statsSection}<!-- STATS_END -->`
  );
  
  fs.writeFileSync(readmePath, readme);
  console.log('README.md updated with GitHub stats');
}

function createDefaultReadme(stats) {
  const username = stats.username;
  const readme = `# ${username}'s GitHub Profile

Welcome to my GitHub profile!

## Languages
<!-- LANGUAGES_START -->
<!-- LANGUAGES_END -->

<!-- STATS_START -->
<!-- STATS_END -->
`;

  fs.writeFileSync(path.join(__dirname, 'README.md'), readme);
  console.log('Created default README.md');
  updateReadme(stats);
}

// Run the script
main();
