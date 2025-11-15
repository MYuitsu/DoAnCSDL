// Node Patients Management - CockroachDB Cluster
const API_BASE = '';

let clusterNodes = [];
let selectedNode = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadClusterInfo();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', function() {
        loadClusterInfo();
        if (selectedNode) {
            loadNodePatients(selectedNode.node_id);
        }
    });

    document.getElementById('queryAllNodesBtn').addEventListener('click', function() {
        queryAllNodes();
    });

    document.getElementById('loadAllNodesBtn').addEventListener('click', function() {
        loadAllNodesData();
    });

    document.getElementById('selectAllNodesBtn').addEventListener('click', function() {
        selectAllNodes();
    });
}

// Load cluster information and nodes
async function loadClusterInfo() {
    try {
        showLoading(true);
        
        // Get cluster nodes
        const response = await fetch(`${API_BASE}/api/cluster/nodes`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Không thể tải thông tin cluster');
        }
        
        clusterNodes = data.nodes;
        
        // Update cluster overview
        updateClusterOverview(data.nodes);
        
        // Render node buttons
        renderNodeButtons(data.nodes);
        
        showLoading(false);
    } catch (error) {
        console.error('Error loading cluster info:', error);
        showError('Lỗi khi tải thông tin cluster: ' + error.message);
        showLoading(false);
    }
}

// Update cluster overview statistics
function updateClusterOverview(nodes) {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(n => n.is_available).length;
    
    document.getElementById('totalNodes').textContent = totalNodes;
    document.getElementById('onlineNodes').textContent = onlineNodes;
    
    // Get total patients count (we'll update this when querying)
    fetchTotalPatients();
}

// Fetch total patients count
async function fetchTotalPatients() {
    try {
        const response = await fetch(`${API_BASE}/api/benhnhan`);
        const data = await response.json();
        document.getElementById('totalPatients').textContent = data.length || 0;
    } catch (error) {
        console.error('Error fetching total patients:', error);
        document.getElementById('totalPatients').textContent = '-';
    }
}

// Render node selection buttons
function renderNodeButtons(nodes) {
    const container = document.getElementById('nodeButtons');
    container.innerHTML = '';
    
    nodes.forEach(node => {
        const button = document.createElement('button');
        button.className = 'node-button';
        
        if (!node.is_available) {
            button.classList.add('node-offline');
            button.disabled = true;
        } else if (node.is_draining) {
            button.classList.add('node-draining');
        }
        
        button.innerHTML = `
            <div class="node-button-header">
                <span class="node-id">Node ${node.node_id}</span>
                <span class="node-status ${node.is_available ? 'status-online' : 'status-offline'}">
                    ${node.is_available ? '🟢 Online' : '🔴 Offline'}
                </span>
            </div>
            <div class="node-button-details">
                <div>📍 ${node.address}</div>
                <div>⏱️ Uptime: ${node.uptime}</div>
                ${node.locality ? `<div>🏷️ ${node.locality}</div>` : ''}
            </div>
        `;
        
        if (node.is_available) {
            button.addEventListener('click', () => selectNode(node));
        }
        
        container.appendChild(button);
    });
}

// Select a node and load its patients
function selectNode(node) {
    selectedNode = node;
    
    // Update button states
    document.querySelectorAll('.node-button').forEach(btn => {
        btn.classList.remove('node-selected');
    });
    event.currentTarget.classList.add('node-selected');
    
    // Load patients from this node
    loadNodePatients(node.node_id);
}

// Load patients from specific node
async function loadNodePatients(nodeId) {
    try {
        showLoading(true);
        document.getElementById('nodeDataSection').style.display = 'none';
        
        const response = await fetch(`${API_BASE}/api/cluster/patients-by-node/${nodeId}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Không thể tải dữ liệu từ node');
        }
        
        // Update node metrics
        document.getElementById('selectedNodeId').textContent = nodeId;
        document.getElementById('nodeAddress').textContent = data.node.address;
        document.getElementById('queryTime').textContent = data.execution_time_ms.toFixed(2);
        document.getElementById('patientCount').textContent = data.total;
        
        // Render patients table
        renderPatientsTable(data.patients, 'patientsTableBody');
        
        // Show/hide sections
        document.getElementById('nodeDataSection').style.display = 'block';
        
        if (data.patients.length === 0) {
            document.getElementById('noDataMessage').style.display = 'block';
            document.querySelector('.table-container').style.display = 'none';
        } else {
            document.getElementById('noDataMessage').style.display = 'none';
            document.querySelector('.table-container').style.display = 'block';
        }
        
        showLoading(false);
    } catch (error) {
        console.error('Error loading node patients:', error);
        showError('Lỗi khi tải dữ liệu bệnh nhân từ node: ' + error.message);
        showLoading(false);
    }
}

// Query all nodes (distributed query)
async function queryAllNodes() {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/api/cluster/patients-distributed`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Không thể thực hiện truy vấn phân tán');
        }
        
        // Update distributed metrics
        document.getElementById('distributedQueryTime').textContent = 
            `${data.execution_time_ms.toFixed(2)} ms`;
        document.getElementById('nodesUsed').textContent = data.nodes_used;
        document.getElementById('distributedTotal').textContent = data.total;
        
        // Render distributed results
        renderPatientsTable(data.patients, 'distributedTableBody');
        
        // Show distributed section
        document.getElementById('distributedDataSection').style.display = 'block';
        
        showLoading(false);
    } catch (error) {
        console.error('Error querying all nodes:', error);
        showError('Lỗi khi truy vấn phân tán: ' + error.message);
        showLoading(false);
    }
}

// Render patients table
function renderPatientsTable(patients, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    
    if (patients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="no-data">Không có dữ liệu</td></tr>';
        return;
    }
    
    patients.forEach((patient, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(patient.ho_ten)}</strong></td>
            <td>${formatDate(patient.ngay_sinh)}</td>
            <td>${patient.gioi_tinh}</td>
            <td>${escapeHtml(patient.so_dien_thoai || '-')}</td>
            <td>${escapeHtml(patient.so_cmnd || '-')}</td>
            <td>${formatAddress(patient)}</td>
            <td>${escapeHtml(patient.email || '-')}</td>
            <td><span class="badge">${patient.total_visits}</span></td>
            <td>${formatDateTime(patient.created_at)}</td>
        `;
        tbody.appendChild(row);
    });
}

// Format address
function formatAddress(patient) {
    const parts = [];
    if (patient.dia_chi) parts.push(patient.dia_chi);
    if (patient.xa) parts.push(patient.xa);
    if (patient.tinh) parts.push(patient.tinh);
    return escapeHtml(parts.join(', ') || '-');
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
}

// Format datetime
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show/hide loading indicator
function showLoading(show) {
    const indicator = document.getElementById('loadingIndicator');
    indicator.style.display = show ? 'flex' : 'none';
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    errorText.textContent = message;
    errorDiv.style.display = 'flex';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        closeError();
    }, 5000);
}

// Select all nodes and display their data individually
async function selectAllNodes() {
    try {
        showLoading(true);
        
        // Get live nodes
        const liveNodes = clusterNodes.filter(node => node.is_available);
        
        if (liveNodes.length === 0) {
            showError('Không có node nào đang hoạt động');
            showLoading(false);
            return;
        }
        
        // Mark all node buttons as selected
        document.querySelectorAll('.node-button').forEach(btn => {
            if (!btn.disabled) {
                btn.classList.add('node-selected');
            }
        });
        
        // Load data from all nodes and display individually
        const promises = liveNodes.map(node => 
            fetch(`${API_BASE}/api/cluster/patients-by-node/${node.node_id}`)
                .then(res => res.json())
                .then(data => ({ node, data }))
                .catch(error => ({ node, error: error.message }))
        );
        
        const results = await Promise.all(promises);
        
        // Display each node's data in the individual node section
        displayAllNodesIndividually(results);
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error selecting all nodes:', error);
        showError('Lỗi khi select tất cả nodes: ' + error.message);
        showLoading(false);
    }
}

// Display all nodes data individually in separate sections
function displayAllNodesIndividually(results) {
    // Hide the single node data section if visible
    document.getElementById('nodeDataSection').style.display = 'none';
    
    // Create a container for all individual node displays
    let allNodesDisplay = document.getElementById('allNodesIndividualDisplay');
    
    if (!allNodesDisplay) {
        // Create the container if it doesn't exist
        const nodeDataSection = document.getElementById('nodeDataSection');
        allNodesDisplay = document.createElement('section');
        allNodesDisplay.id = 'allNodesIndividualDisplay';
        allNodesDisplay.className = 'all-nodes-individual-display';
        nodeDataSection.parentNode.insertBefore(allNodesDisplay, nodeDataSection.nextSibling);
    }
    
    allNodesDisplay.innerHTML = '<h2 class="section-title">📊 Dữ Liệu Từ Tất Cả Nodes</h2>';
    
    results.forEach(({ node, data, error }) => {
        const nodeSection = document.createElement('div');
        nodeSection.className = 'individual-node-section';
        
        if (error) {
            nodeSection.innerHTML = `
                <div class="node-section-header error">
                    <h3>🔴 Node ${node.node_id} - ${node.address}</h3>
                    <span class="error-badge">Lỗi</span>
                </div>
                <div class="node-section-body">
                    <p class="error-text">⚠️ ${error}</p>
                </div>
            `;
        } else if (!data.success) {
            nodeSection.innerHTML = `
                <div class="node-section-header error">
                    <h3>🔴 Node ${node.node_id} - ${node.address}</h3>
                    <span class="error-badge">Lỗi</span>
                </div>
                <div class="node-section-body">
                    <p class="error-text">⚠️ ${data.error}</p>
                </div>
            `;
        } else {
            const headerHtml = `
                <div class="node-section-header success">
                    <h3>🟢 Node ${node.node_id} - ${data.node.address}</h3>
                    <div class="node-section-metrics">
                        <span class="metric-badge">⏱️ ${data.execution_time_ms.toFixed(2)} ms</span>
                        <span class="metric-badge">👥 ${data.total} bệnh nhân</span>
                    </div>
                </div>
            `;
            
            const bodyHtml = data.patients.length === 0 ? 
                '<div class="node-section-body"><p class="no-data-text">Không có dữ liệu bệnh nhân</p></div>' :
                `<div class="node-section-body">
                    <div class="table-container">
                        <table class="patients-table">
                            <thead>
                                <tr>
                                    <th>STT</th>
                                    <th>Họ và Tên</th>
                                    <th>Ngày Sinh</th>
                                    <th>Giới Tính</th>
                                    <th>Số Điện Thoại</th>
                                    <th>CMND/CCCD</th>
                                    <th>Địa Chỉ</th>
                                    <th>Email</th>
                                    <th>Số Lần Khám</th>
                                    <th>Ngày Tạo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateTableRows(data.patients)}
                            </tbody>
                        </table>
                    </div>
                </div>`;
            
            nodeSection.innerHTML = headerHtml + bodyHtml;
        }
        
        allNodesDisplay.appendChild(nodeSection);
    });
    
    allNodesDisplay.style.display = 'block';
    
    // Scroll to the display section
    allNodesDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Generate table rows HTML
function generateTableRows(patients) {
    return patients.map((patient, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(patient.ho_ten)}</strong></td>
            <td>${formatDate(patient.ngay_sinh)}</td>
            <td>${patient.gioi_tinh}</td>
            <td>${escapeHtml(patient.so_dien_thoai || '-')}</td>
            <td>${escapeHtml(patient.so_cmnd || '-')}</td>
            <td>${formatAddress(patient)}</td>
            <td>${escapeHtml(patient.email || '-')}</td>
            <td><span class="badge">${patient.total_visits}</span></td>
            <td>${formatDateTime(patient.created_at)}</td>
        </tr>
    `).join('');
}

// Load data from all live nodes simultaneously
async function loadAllNodesData() {
    try {
        showLoading(true);
        
        // Get live nodes first
        const liveNodes = clusterNodes.filter(node => node.is_available);
        
        if (liveNodes.length === 0) {
            showError('Không có node nào đang hoạt động');
            showLoading(false);
            return;
        }
        
        // Load data from all live nodes in parallel
        const promises = liveNodes.map(node => 
            fetch(`${API_BASE}/api/cluster/patients-by-node/${node.node_id}`)
                .then(res => res.json())
                .then(data => ({ node, data }))
                .catch(error => ({ node, error: error.message }))
        );
        
        const results = await Promise.all(promises);
        
        // Render results
        renderAllNodesData(results);
        
        document.getElementById('allNodesContainer').style.display = 'block';
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading all nodes data:', error);
        showError('Lỗi khi tải dữ liệu từ tất cả nodes: ' + error.message);
        showLoading(false);
    }
}

// Render data from all nodes
function renderAllNodesData(results) {
    const container = document.getElementById('allNodesContainer');
    container.innerHTML = '';
    
    results.forEach(({ node, data, error }) => {
        const nodeCard = document.createElement('div');
        nodeCard.className = 'node-data-card';
        
        if (error) {
            nodeCard.innerHTML = `
                <div class="node-card-header error">
                    <h3>🔴 Node ${node.node_id} - ${node.address}</h3>
                    <span class="error-badge">Lỗi</span>
                </div>
                <div class="node-card-body">
                    <p class="error-text">⚠️ ${error}</p>
                </div>
            `;
        } else if (!data.success) {
            nodeCard.innerHTML = `
                <div class="node-card-header error">
                    <h3>🔴 Node ${node.node_id} - ${node.address}</h3>
                    <span class="error-badge">Lỗi</span>
                </div>
                <div class="node-card-body">
                    <p class="error-text">⚠️ ${data.error}</p>
                </div>
            `;
        } else {
            nodeCard.innerHTML = `
                <div class="node-card-header success">
                    <h3>🟢 Node ${node.node_id} - ${data.node.address}</h3>
                    <div class="node-card-metrics">
                        <span class="metric-badge">⏱️ ${data.execution_time_ms.toFixed(2)} ms</span>
                        <span class="metric-badge">👥 ${data.total} bệnh nhân</span>
                    </div>
                </div>
                <div class="node-card-body">
                    ${data.patients.length === 0 ? 
                        '<p class="no-data-text">Không có dữ liệu bệnh nhân</p>' :
                        generateNodeTable(data.patients)
                    }
                </div>
            `;
        }
        
        container.appendChild(nodeCard);
    });
}

// Generate table HTML for a node
function generateNodeTable(patients) {
    let html = `
        <div class="node-table-container">
            <table class="node-mini-table">
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Họ và Tên</th>
                        <th>Ngày Sinh</th>
                        <th>Giới Tính</th>
                        <th>Số ĐT</th>
                        <th>Địa Chỉ</th>
                        <th>Số Lần Khám</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    patients.forEach((patient, index) => {
        html += `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(patient.ho_ten)}</strong></td>
                <td>${formatDate(patient.ngay_sinh)}</td>
                <td>${patient.gioi_tinh}</td>
                <td>${escapeHtml(patient.so_dien_thoai || '-')}</td>
                <td>${formatAddress(patient)}</td>
                <td><span class="badge">${patient.total_visits}</span></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

// Close error message
function closeError() {
    document.getElementById('errorMessage').style.display = 'none';
}
