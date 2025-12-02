// API Configuration
const API_URL = 'http://localhost:3000/api';

// State Management
let persons = [];
let currentTeams = [];
let savedTeams = [];
let editingPersonId = null;

// DOM Elements
const personsGrid = document.getElementById('persons-grid');
const teamsDisplay = document.getElementById('teams-display');
const savedTeamsList = document.getElementById('saved-teams-list');
const personModal = document.getElementById('person-modal');
const personForm = document.getElementById('person-form');
const addPersonBtn = document.getElementById('add-person-btn');
const generateBtn = document.getElementById('generate-btn');
const saveTeamsBtn = document.getElementById('save-teams-btn');
const numTeamsInput = document.getElementById('num-teams');
const closeModal = document.querySelector('.close');
const cancelBtn = document.getElementById('cancel-btn');
const photoInput = document.getElementById('person-photo');
const photoPreview = document.getElementById('photo-preview');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await loadPersons();
    await loadSavedTeams();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    addPersonBtn.addEventListener('click', openAddPersonModal);
    closeModal.addEventListener('click', closePersonModal);
    cancelBtn.addEventListener('click', closePersonModal);
    personForm.addEventListener('submit', handlePersonSubmit);
    generateBtn.addEventListener('click', generateTeams);
    saveTeamsBtn.addEventListener('click', saveCurrentTeams);
    photoInput.addEventListener('change', handlePhotoPreview);
    
    window.addEventListener('click', (e) => {
        if (e.target === personModal) {
            closePersonModal();
        }
    });
}

// Person Management
async function loadPersons() {
    try {
        const response = await fetch(`${API_URL}/persons`);
        persons = await response.json();
        renderPersons();
    } catch (error) {
        console.error('Error loading persons:', error);
        persons = [];
        renderPersons();
    }
}

function renderPersons() {
    if (persons.length === 0) {
        personsGrid.innerHTML = '<div class="empty-state">No players yet. Add your first player!</div>';
        return;
    }

    personsGrid.innerHTML = persons.map(person => `
        <div class="player-card">
            <div class="player-card-content">
                <img src="${person.photo || './public/assets/default-avatar.png'}" 
                     alt="${person.name}" 
                     class="player-photo"
                     onerror="this.src='./public/assets/default-avatar.png'">
                <div class="player-name">${person.name}</div>
                <div class="player-stats">
                    <div class="stat-item">
                        <span class="stat-label">PAC</span>
                        <span class="stat-value">${person.stats.pace}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">SHO</span>
                        <span class="stat-value">${person.stats.shooting}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">PAS</span>
                        <span class="stat-value">${person.stats.passing}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">DRI</span>
                        <span class="stat-value">${person.stats.dribbling}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">DEF</span>
                        <span class="stat-value">${person.stats.defending}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">PHY</span>
                        <span class="stat-value">${person.stats.physical}</span>
                    </div>
                </div>
                <div class="player-actions">
                    <button class="btn btn-primary" onclick="editPerson('${person._id}')">Edit</button>
                    <button class="btn btn-danger" onclick="deletePerson('${person._id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function openAddPersonModal() {
    editingPersonId = null;
    document.getElementById('modal-title').textContent = 'Add New Player';
    personForm.reset();
    photoPreview.innerHTML = '';
    personModal.style.display = 'block';
}

function closePersonModal() {
    personModal.style.display = 'none';
    editingPersonId = null;
}

async function handlePersonSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('person-name').value);
    formData.append('stats', JSON.stringify({
        pace: parseInt(document.getElementById('stat-pace').value),
        shooting: parseInt(document.getElementById('stat-shooting').value),
        passing: parseInt(document.getElementById('stat-passing').value),
        dribbling: parseInt(document.getElementById('stat-dribbling').value),
        defending: parseInt(document.getElementById('stat-defending').value),
        physical: parseInt(document.getElementById('stat-physical').value)
    }));
    
    if (photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
    }

    try {
        const url = editingPersonId 
            ? `${API_URL}/persons/${editingPersonId}`
            : `${API_URL}/persons`;
        
        const method = editingPersonId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });

        if (response.ok) {
            await loadPersons();
            closePersonModal();
        } else {
            alert('Error saving person');
        }
    } catch (error) {
        console.error('Error saving person:', error);
        alert('Error saving person');
    }
}

window.editPerson = async function(id) {
    editingPersonId = id;
    const person = persons.find(p => p._id === id);
    
    if (person) {
        document.getElementById('modal-title').textContent = 'Edit Player';
        document.getElementById('person-name').value = person.name;
        document.getElementById('stat-pace').value = person.stats.pace;
        document.getElementById('stat-shooting').value = person.stats.shooting;
        document.getElementById('stat-passing').value = person.stats.passing;
        document.getElementById('stat-dribbling').value = person.stats.dribbling;
        document.getElementById('stat-defending').value = person.stats.defending;
        document.getElementById('stat-physical').value = person.stats.physical;
        
        if (person.photo) {
            photoPreview.innerHTML = `<img src="${person.photo}" alt="Preview">`;
        }
        
        personModal.style.display = 'block';
    }
};

window.deletePerson = async function(id) {
    if (confirm('Are you sure you want to delete this player?')) {
        try {
            const response = await fetch(`${API_URL}/persons/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await loadPersons();
            } else {
                alert('Error deleting person');
            }
        } catch (error) {
            console.error('Error deleting person:', error);
            alert('Error deleting person');
        }
    }
};

function handlePhotoPreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            photoPreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

// Team Generation
function generateTeams() {
    const numTeams = parseInt(numTeamsInput.value);
    
    if (persons.length < numTeams) {
        alert(`You need at least ${numTeams} players to create ${numTeams} teams!`);
        return;
    }

    // Shuffle persons array
    const shuffled = [...persons].sort(() => Math.random() - 0.5);
    
    // Initialize teams
    currentTeams = Array.from({ length: numTeams }, (_, i) => ({
        name: `Team ${i + 1}`,
        members: []
    }));

    // Distribute persons to teams
    shuffled.forEach((person, index) => {
        const teamIndex = index % numTeams;
        currentTeams[teamIndex].members.push(person);
    });

    renderTeams();
    saveTeamsBtn.style.display = 'inline-block';
}

function renderTeams() {
    if (currentTeams.length === 0) {
        teamsDisplay.innerHTML = '<div class="empty-state">Generate teams to see them here!</div>';
        return;
    }

    teamsDisplay.innerHTML = currentTeams.map(team => {
        const avgOverall = team.members.length > 0
            ? Math.round(team.members.reduce((sum, member) => {
                const overall = Object.values(member.stats).reduce((a, b) => a + b, 0) / 6;
                return sum + overall;
            }, 0) / team.members.length)
            : 0;

        return `
            <div class="team-container">
                <div class="team-header">
                    <div class="team-name">${team.name}</div>
                    <div class="team-avg">Average Rating: ${avgOverall}</div>
                    <div class="team-avg">Players: ${team.members.length}</div>
                </div>
                <div class="team-members">
                    ${team.members.map(member => {
                        const overall = Math.round(Object.values(member.stats).reduce((a, b) => a + b, 0) / 6);
                        return `
                            <div class="team-member">
                                <img src="${member.photo || './public/assets/default-avatar.png'}" 
                                     alt="${member.name}" 
                                     class="team-member-photo"
                                     onerror="this.src='./public/assets/default-avatar.png'">
                                <div class="team-member-info">
                                    <div class="team-member-name">${member.name}</div>
                                    <div class="team-member-overall">OVR: ${overall}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Saved Teams Management
async function saveCurrentTeams() {
    if (currentTeams.length === 0) {
        alert('No teams to save!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ teams: currentTeams })
        });

        if (response.ok) {
            alert('Teams saved successfully!');
            await loadSavedTeams();
        } else {
            alert('Error saving teams');
        }
    } catch (error) {
        console.error('Error saving teams:', error);
        alert('Error saving teams');
    }
}

async function loadSavedTeams() {
    try {
        const response = await fetch(`${API_URL}/teams`);
        savedTeams = await response.json();
        renderSavedTeams();
    } catch (error) {
        console.error('Error loading saved teams:', error);
        savedTeams = [];
        renderSavedTeams();
    }
}

function renderSavedTeams() {
    if (savedTeams.length === 0) {
        savedTeamsList.innerHTML = '<div class="empty-state">No saved teams yet. Generate and save teams!</div>';
        return;
    }

    savedTeamsList.innerHTML = savedTeams.map(saved => `
        <div class="saved-team-item">
            <div class="saved-team-header">
                <div class="saved-team-date">
                    Saved on: ${new Date(saved.createdAt).toLocaleString()}
                </div>
                <div class="saved-team-actions">
                    <button class="btn btn-primary" onclick="loadTeam('${saved._id}')">Load</button>
                    <button class="btn btn-danger" onclick="deleteSavedTeam('${saved._id}')">Delete</button>
                </div>
            </div>
            <div class="saved-team-content">
                ${saved.teams.map(team => `
                    <div>
                        <strong>${team.name}</strong>: ${team.members.length} players
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

window.loadTeam = function(id) {
    const saved = savedTeams.find(s => s._id === id);
    if (saved) {
        currentTeams = saved.teams;
        renderTeams();
        saveTeamsBtn.style.display = 'inline-block';
        window.scrollTo({ top: document.getElementById('generator-section').offsetTop, behavior: 'smooth' });
    }
};

window.deleteSavedTeam = async function(id) {
    if (confirm('Are you sure you want to delete this saved team configuration?')) {
        try {
            const response = await fetch(`${API_URL}/teams/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                await loadSavedTeams();
            } else {
                alert('Error deleting saved team');
            }
        } catch (error) {
            console.error('Error deleting saved team:', error);
            alert('Error deleting saved team');
        }
    }
};