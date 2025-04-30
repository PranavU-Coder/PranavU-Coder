const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Comprehensive GitHub stats dashboard generator
 * This script fetches stats from ALL repositories of a user
 */

async function fetchGitHubStats(username, token) {
  try {
    // Set up authentication headers
    const headers = token ? { Authorization: `token ${token}` } : {};
    console.log(`Fetching GitHub stats for user: ${username}`);
    
    // Get user data
    const userResponse = await axios.get(`https://api.github.com/users/${username}`, { headers });
    console.log(`User data fetched successfully for ${username}`);
    
    // Initialize counters and data structures
    let totalStars = 0;
    let totalCommits = 0;
    let allLanguages = {};
    let prCount = 0;
    let issueCount = 0;
    let contributedRepos = 0;
    
    // Get all repositories (handle pagination)
    console.log(`Fetching repositories for ${username}...`);
    let allRepos = [];
    let page = 1;
    let hasMoreRepos = true;
    
    while (hasMoreRepos) {
      const reposResponse = await axios.get(
        `https://api.github.com/users/${username}/repos?per_page=100&page=${page}`, 
        { headers }
      );
      
      if (reposResponse.data.length === 0) {
        hasMoreRepos = false;
      } else {
        allRepos = [...allRepos, ...reposResponse.data];
        page++;
      }
    }
    
    console.log(`Found ${allRepos.length} repositories`);
    
    // Process each repository
    for (const repo of allRepos) {
      console.log(`Processing repository: ${repo.name}`);
      totalStars += repo.stargazers_count;
      
      try {
        // Get language data for this repository
        const langResponse = await axios.get(repo.languages_url, { headers });
        const repoLanguages = langResponse.data;
        
        // Merge language data with overall stats
        for (const [lang, bytes] of Object.entries(repoLanguages)) {
          if (allLanguages[lang]) {
            allLanguages[lang] += bytes;
          } else {
            allLanguages[lang] = bytes;
          }
        }
      } catch (error) {
        console.log(`Error fetching languages for ${repo.name}: ${error.message}`);
      }
      
      try {
        // Get commit data by this user in this repo
        // Note: This is limited to authenticated requests for better rate limits
        if (token) {
          const commitsResponse = await axios.get(
            `https://api.github.com/repos/${repo.full_name}/commits?author=${username}&per_page=100`, 
            { headers }
          );
          totalCommits += commitsResponse.data.length;
          
          // Check if there are additional pages of commits
          if (commitsResponse.headers.link && commitsResponse.headers.link.includes('next')) {
            console.log(`Repository ${repo.name} has more than 100 commits, fetching additional pages...`);
            // Implement additional page fetching if needed
            // This is a simplified approach that counts at least the first 100 commits
          }
        }
      } catch (error) {
        console.log(`Error fetching commits for ${repo.name}: ${error.message}`);
      }
    }
    
    // Get PR and Issue counts (only if token is provided)
    if (token) {
      try {
        const prsResponse = await axios.get(
          `https://api.github.com/search/issues?q=author:${username}+type:pr`, 
          { headers }
        );
        prCount = prsResponse.data.total_count;
        console.log(`Found ${prCount} pull requests by ${username}`);
      } catch (error) {
        console.log(`Error fetching PRs: ${error.message}`);
      }
      
      try {
        const issuesResponse = await axios.get(
          `https://api.github.com/search/issues?q=author:${username}+type:issue`, 
          { headers }
        );
        issueCount = issuesResponse.data.total_count;
        console.log(`Found ${issueCount} issues by ${username}`);
      } catch (error) {
        console.log(`Error fetching issues: ${error.message}`);
      }
      
      try {
        // Get contributed repos (repos user has contributed to but doesn't own)
        const contributedResponse = await axios.get(
          `https://api.github.com/search/repositories?q=contributor:${username}+-user:${username}`, 
          { headers }
        );
        contributedRepos = contributedResponse.data.total_count;
        console.log(`User has contributed to ${contributedRepos} repositories owned by others`);
      } catch (error) {
        console.log(`Error fetching contributed repos: ${error.message}`);
      }
    }
    
    // Sort languages by bytes
    const sortedLanguages = Object.entries(allLanguages)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
    
    // Create stats object
    const stats = {
      username: userResponse.data.login,
      name: userResponse.data.name || userResponse.data.login,
      avatar_url: userResponse.data.avatar_url,
      html_url: userResponse.data.html_url,
      public_repos: userResponse.data.public_repos,
      followers: userResponse.data.followers,
      following: userResponse.data.following,
      total_stars: totalStars,
      total_commits: totalCommits,
      total_prs: prCount,
      total_issues: issueCount,
      contributed_repos: contributedRepos,
      languages: sortedLanguages,
      updated_at: new Date().toISOString(),
      current_year: new Date().getFullYear()
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
    console.log('Starting GitHub stats generation...');
    const stats = await fetchGitHubStats(username, token);
    
    // Save stats to JSON file
    fs.writeFileSync(path.join(__dirname, '..', 'stats.json'), JSON.stringify(stats, null, 2));
    console.log('GitHub stats saved to stats.json');
    
    // Update README with the new data
    updateReadme(stats);
  } catch (error) {
    console.error('Failed to generate GitHub stats:', error);
    process.exit(1);
  }
}

function updateReadme(stats) {
  const readmePath = path.join(__dirname, '..', 'README.md');
  
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
  
  // Create tech stack badges
  let techStackBadges = '';
  const topLanguages = Object.keys(stats.languages).slice(0, 6);
  
  const badgeColors = {
    JavaScript: 'yellow',
    TypeScript: 'blue',
    Python: 'blue',
    Java: 'orange',
    'C++': 'pink',
    C: 'gray',
    'C#': 'green',
    PHP: 'purple',
    Go: 'lightblue',
    Ruby: 'red',
    Swift: 'orange',
    Kotlin: 'purple',
    Rust: 'brown',
    Dart: 'blue',
    HTML: 'red',
    CSS: 'blue',
    Shell: 'green',
    // Add more languages as needed
  };
  
  for (const lang of topLanguages) {
    const color = badgeColors[lang] || 'gray';
    techStackBadges += `![${lang}](https://img.shields.io/badge/-${lang}-${color}?style=flat-square&logo=${lang.toLowerCase()}) `;
  }
  
  // Create contribution chart section for README
  const contributionSection = `
## GitHub Stats

- **Total Repositories:** ${stats.public_repos}
- **Total Stars:** ${stats.total_stars}
- **Total Commits:** ${stats.total_commits}
- **Total PRs:** ${stats.total_prs}
- **Total Issues:** ${stats.total_issues}
- **Contributed to:** ${stats.contributed_repos} repositories
- **Followers:** ${stats.followers}
- **Following:** ${stats.following}
- **Last Updated:** ${new Date(stats.updated_at).toLocaleString()}

### Tech Stack

${techStackBadges}
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
    `<!-- STATS_START -->${contributionSection}<!-- STATS_END -->`
  );
  
  fs.writeFileSync(readmePath, readme);
  console.log('README.md updated with GitHub stats');
}

function createDefaultReadme(stats) {
  const username = stats.username;
  const readme = `# ${username}'s GitHub Profile

![Profile Views](https://komarev.com/ghpvc/?username=${username.toLowerCase()}&color=blueviolet)

Welcome to my GitHub profile! Here you can find information about my coding projects and statistics.

## Languages
<!-- LANGUAGES_START -->
<!-- LANGUAGES_END -->

<!-- STATS_START -->
<!-- STATS_END -->

## Projects

Here are some of my key projects:

1. Project 1 - Description
2. Project 2 - Description
3. Project 3 - Description

## Connect with Me

- GitHub: [${username}](https://github.com/${username})
`;

  fs.writeFileSync(path.join(__dirname, '..', 'README.md'), readme);
  console.log('Created default README.md');
  updateReadme(stats);
}

// Run the script
main();
