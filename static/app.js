const API_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:5000/api'
    : '/api';

let authToken = null;
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('login-btn').addEventListener('click', loginWithDiscord);
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Menu navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });

    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchTab(tabName);
        });
    });
}

function checkAuth() {
    authToken = localStorage.getItem('auth_token');
    if (authToken) {
        verifyAuth();
    } else {
        showPage('login-page');
    }
}

async function verifyAuth() {
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            document.getElementById('username').textContent = currentUser.username;
            showPage('dashboard-page');
            loadOverview();
            loadUserFleets();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Auth verification failed:', error);
        logout();
    }
}

async function loginWithDiscord() {
    try {
        const response = await fetch(`${API_URL}/auth/discord/url`);
        const data = await response.json();
        
        const authWindow = window.open(data.auth_url, 'Discord Login', 'width=500,height=700');
        
        // Listen for authentication success message
        const messageHandler = (event) => {
            if (event.data.type === 'discord-auth-success') {
                authToken = event.data.token;
                currentUser = event.data.user;
                
                // Normalize user object - ensure user_id is available
                if (currentUser.id && !currentUser.user_id) {
                    currentUser.user_id = currentUser.id;
                }
                
                localStorage.setItem('auth_token', authToken);
                
                document.getElementById('username').textContent = currentUser.username;
                showPage('dashboard-page');
                loadOverview();
                loadUserFleets();
                
                // Remove event listener after successful auth
                window.removeEventListener('message', messageHandler);
            }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Check if auth window was closed without completing
        const checkClosed = setInterval(() => {
            if (authWindow.closed) {
                clearInterval(checkClosed);
                window.removeEventListener('message', messageHandler);
                
                // If we don't have a token, authentication was cancelled
                if (!authToken) {
                    console.log('Authentication cancelled');
                }
            }
        }, 500);
        
    } catch (error) {
        console.error('Login failed:', error);
        alert('Login failed. Please try again.');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('auth_token');
    showPage('login-page');
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function switchView(viewName) {
    // Update menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

    // Update view
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');

    // Load data for view
    switch(viewName) {
        case 'overview':
            loadOverview();
            break;
        case 'fleets':
            loadUserFleets();
            break;
        case 'leaderboards':
            loadLeaderboard('damage');
            break;
        case 'tournaments':
            loadTournaments();
            break;
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    loadLeaderboard(tabName);
}

async function loadOverview() {
    try {
        const response = await fetch(`${API_URL}/stats/overview`);
        const data = await response.json();

        document.getElementById('total-fleets').textContent = data.stats.total_fleets;
        document.getElementById('total-members').textContent = data.stats.total_members;
        document.getElementById('total-records').textContent = data.stats.total_records;
        document.getElementById('total-ships').textContent = data.stats.total_ships;
    } catch (error) {
        console.error('Failed to load overview:', error);
    }
}

async function loadUserFleets() {
    try {
        const response = await fetch(`${API_URL}/fleets`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();

        const fleetList = document.getElementById('fleet-list');
        fleetList.innerHTML = '';

        if (data.fleets.length === 0) {
            fleetList.innerHTML = '<p class="text-gray">You are not a member of any fleet yet.</p>';
            return;
        }

        data.fleets.forEach(fleet => {
            const fleetCard = document.createElement('div');
            fleetCard.className = 'fleet-card';
            fleetCard.onclick = () => loadFleetDetails(fleet.id);

            fleetCard.innerHTML = `
                <div class="fleet-header">
                    <img src="${fleet.logo_url || 'data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"60\" height=\"60\"><rect width=\"60\" height=\"60\" fill=\"%235865F2\"/></svg>'}" 
                         class="fleet-logo" 
                         alt="${fleet.name}">
                    <div class="fleet-info">
                        <h3>${fleet.name}</h3>
                        <div class="fleet-tag">[${fleet.tag}]</div>
                    </div>
                </div>
                <p style="color: #94a3b8; margin-bottom: 1rem;">${fleet.description || 'No description'}</p>
                <div class="user-role-badge">${fleet.user_role}</div>
                <div class="fleet-stats">
                    <div class="fleet-stat">
                        <div class="fleet-stat-value">${fleet.member_count}</div>
                        <div class="fleet-stat-label">Members</div>
                    </div>
                </div>
            `;

            fleetList.appendChild(fleetCard);
        });
    } catch (error) {
        console.error('Failed to load fleets:', error);
    }
}

async function loadFleetDetails(fleetId) {
    try:
        const response = await fetch(`${API_URL}/fleets/${fleetId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();

        const detailsDiv = document.getElementById('fleet-details');
        detailsDiv.classList.remove('hidden');

        // Fix: Use currentUser.user_id to match JWT payload structure
        const isCommander = data.fleet.members.find(m => m.discord_id === String(currentUser.user_id) && (m.role === 'Fleet Commander' || m.role === 'Deputy Commander'));

        detailsDiv.innerHTML = `
            <div class="fleet-management-header">
                <h3>${data.fleet.name} Management</h3>
                <button class="btn-secondary" onclick="document.getElementById('fleet-details').classList.add('hidden')">Close</button>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value">${data.fleet.stats.member_count}</div>
                    <div class="stat-label">Members</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🎯</div>
                    <div class="stat-value">${data.fleet.stats.record_count}</div>
                    <div class="stat-label">Records</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💎</div>
                    <div class="stat-value">${data.fleet.stats.total_points.toLocaleString()}</div>
                    <div class="stat-label">Total Points</div>
                </div>
            </div>

            <h4 style="margin-top: 2rem; margin-bottom: 1rem;">Fleet Members</h4>
            <table class="members-table">
                <thead>
                    <tr>
                        <th>Member</th>
                        <th>Role</th>
                        <th>Join Date</th>
                        ${isCommander ? '<th>Actions</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${data.fleet.members.map(member => `
                        <tr>
                            <td>${member.username}</td>
                            <td><span class="user-role-badge">${member.role}</span></td>
                            <td>${member.join_date ? new Date(member.join_date).toLocaleDateString() : 'N/A'}</td>
                            ${isCommander && member.role !== 'Fleet Commander' ? `
                                <td class="member-actions">
                                    <button class="btn-sm btn-promote" onclick="promoteMember(${fleetId}, ${member.id}, '${member.role}', '${member.username}')">Promote</button>
                                    <button class="btn-sm btn-remove" onclick="removeMember(${fleetId}, ${member.id}, '${member.username}')">Remove</button>
                                </td>
                            ` : isCommander ? '<td>-</td>' : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        detailsDiv.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Failed to load fleet details:', error);
    }
}

async function promoteMember(fleetId, memberId, currentRole, memberName) {
    const roles = ['Member', 'Officer', 'Deputy Commander'];
    const currentIndex = roles.indexOf(currentRole);
    const newRole = roles[Math.min(currentIndex + 1, roles.length - 1)];

    if (currentRole === newRole) {
        alert('Member is already at maximum rank (except Fleet Commander).');
        return;
    }

    if (!confirm(`Promote ${memberName} from ${currentRole} to ${newRole}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/fleets/${fleetId}/promote`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                member_id: memberId,
                new_role: newRole
            })
        });

        if (response.ok) {
            alert(`${memberName} promoted to ${newRole}!`);
            loadFleetDetails(fleetId);
        } else {
            const error = await response.json();
            alert(`Failed to promote member: ${error.error}`);
        }
    } catch (error) {
        console.error('Failed to promote member:', error);
        alert('Failed to promote member');
    }
}

async function removeMember(fleetId, memberId, memberName) {
    if (!confirm(`Remove ${memberName} from the fleet?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/fleets/${fleetId}/remove-member`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                member_id: memberId
            })
        });

        if (response.ok) {
            alert(`${memberName} removed from fleet!`);
            loadFleetDetails(fleetId);
        } else {
            const error = await response.json();
            alert(`Failed to remove member: ${error.error}`);
        }
    } catch (error) {
        console.error('Failed to remove member:', error);
        alert('Failed to remove member');
    }
}

async function loadLeaderboard(type) {
    try {
        const endpoint = type === 'damage' ? 'damage' : type === 'xp' ? 'xp' : 'points';
        const response = await fetch(`${API_URL}/leaderboards/${endpoint}`);
        const data = await response.json();

        const content = document.getElementById('leaderboard-content');
        content.innerHTML = `
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        ${type !== 'points' ? '<th>Ship</th><th>Tier</th>' : ''}
                        <th>${type === 'damage' ? 'Damage' : type === 'xp' ? 'Base XP' : 'Points'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.leaderboard.map(entry => `
                        <tr>
                            <td>
                                <span class="rank-badge ${entry.rank <= 3 ? `rank-${entry.rank}` : ''}">${entry.rank}</span>
                            </td>
                            <td>${entry.player}</td>
                            ${type !== 'points' ? `<td>${entry.ship}</td><td>Tier ${entry.tier}</td>` : ''}
                            <td style="font-weight: 700; color: #5865F2;">
                                ${type === 'damage' ? entry.damage.toLocaleString() :
                                  type === 'xp' ? entry.base_xp.toLocaleString() :
                                  entry.points.toLocaleString()}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

async function loadTournaments() {
    try {
        const response = await fetch(`${API_URL}/tournaments`);
        const data = await response.json();

        const tournamentList = document.getElementById('tournament-list');
        
        if (data.tournaments.length === 0) {
            tournamentList.innerHTML = '<p class="text-gray">No tournaments available.</p>';
            return;
        }

        tournamentList.innerHTML = data.tournaments.map(tournament => `
            <div class="stat-card" style="text-align: left; margin-bottom: 1rem;">
                <h3 style="margin-bottom: 0.5rem;">${tournament.name}</h3>
                <p style="color: #94a3b8; margin-bottom: 0.5rem;">Status: <span style="color: ${tournament.status === 'active' ? '#22c55e' : '#94a3b8'}">${tournament.status}</span></p>
                <p style="color: #94a3b8;">Participants: ${tournament.participants.length}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load tournaments:', error);
    }
}
