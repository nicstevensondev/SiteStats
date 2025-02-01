fetch(chrome.runtime.getURL("config.json"))
    .then(response => response.json())
    .then(config => {
        // AWS Configuration
        AWS.config.update({
            region: config.region,
            credentials: new AWS.CognitoIdentityCredentials({
                IdentityPoolId: config.identityPoolId,
            }),
            dynamoDbCrc32: false, // Fix CRC32 error
        });

        const docClient = new AWS.DynamoDB.DocumentClient();

        async function fetchEvents() {
            try {
                const params = {
                    TableName: "search_log",
                    ConsistentRead: true,
                };

                const data = await docClient.scan(params).promise();
                return data.Items || [];
            } catch (err) {
                console.error("Error fetching events:", err);
                return [];
            }
        }

        function getDomain(url) {
            try {
                const hostname = new URL(url).hostname.replace("www.", "");
                return hostname;
            } catch {
                return url;
            }
        }

        function getFavicon(domain) {
            return `https://icon.horse/icon/${domain}`;
        }

        document.getElementById("fetch-events").addEventListener("click", async () => {
            const resultElement = document.getElementById("result");
            resultElement.textContent = "Loading...";

            try {
                const events = await fetchEvents();
                if (!events.length) {
                    resultElement.textContent = "No data found.";
                    return;
                }

                const domainVisits = {};
                const domainScrolls = {};  // Track scrolls per domain
                const domainTimestamps = {};

                events.forEach(event => {
                    const domain = getDomain(event.pageAddress);

                    domainVisits[domain] = (domainVisits[domain] || 0) + 1;
                    domainScrolls[domain] = (domainScrolls[domain] || 0) + event.scrolls;  // Track scrolls

                    if (!domainTimestamps[domain]) domainTimestamps[domain] = [];
                    domainTimestamps[domain].push(new Date(event.timestamp).getTime());
                });

                const domainTimeSpent = {};
                for (const domain in domainTimestamps) {
                    const times = domainTimestamps[domain].sort((a, b) => a - b);
                    let totalDuration = 0;

                    for (let i = 0; i < times.length - 1; i++) {
                        let diff = (times[i + 1] - times[i]) / 1000; // Convert to seconds

                        if (diff < 1800) totalDuration += diff;
                    }

                    totalDuration += 120;

                    domainTimeSpent[domain] = totalDuration;
                }

                const sortedDomains = Object.keys(domainVisits)
                    .map(domain => ({
                        domain,
                        visits: domainVisits[domain],
                        scrolls: domainScrolls[domain] || 0, 
                        timeSpent: domainTimeSpent[domain] || 0,
                    }))
                    .sort((a, b) => b.timeSpent - a.timeSpent);

                const totalVisits = sortedDomains.reduce((sum, d) => sum + d.visits, 0);
                const totalTimeSpent = sortedDomains.reduce((sum, d) => sum + d.timeSpent, 0);
                const topDomains = sortedDomains.slice(0, 8);
                const otherCount = totalVisits - topDomains.reduce((sum, d) => sum + d.visits, 0);
                const otherTimeSpent = totalTimeSpent - topDomains.reduce((sum, d) => sum + d.timeSpent, 0);

                resultElement.innerHTML = `
                    <ul>
                        ${topDomains.map(({ domain, visits, scrolls, timeSpent }) => `
                            <li>
                                <div class="site-info">
                                    <img src="https://icon.horse/icon/${domain}" alt="icon" width="20" />
                                    <span class="domain">${getDomain(domain)}</span>
                                </div>
                                <div class="stats">
                                    <span class="visit-count"><strong>${visits}</strong> visits</span>
                                    <span class="time-spent">🕒 ${Math.round(timeSpent / 60)} min</span>
                                </div>
                            </li>
                        `).join("")}
            
                        ${otherCount > 0 ? `
                            <li class="other">
                                <div class="site-info">
                                    <span class="domain">Other</span>
                                </div>
                                <div class="stats">
                                    <span class="visit-count"><strong>${otherCount}</strong> visits</span>
                                    <span class="time-spent">🕒 ~${Math.round(otherTimeSpent / 60)} min</span>
                                </div>
                            </li>
                        ` : ""}
                    </ul>
                `;
            } catch (error) {
                resultElement.textContent = "Error fetching data.";
                console.error("Error processing data:", error);
            }
        });

    })
    .catch(err => console.error("Error loading config.json:", err));
