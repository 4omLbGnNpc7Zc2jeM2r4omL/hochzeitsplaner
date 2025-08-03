/**
 * SQLite Datenbank-Verwaltung JavaScript
 * Funktionalität für Admin-Panel zur Datenbank-Einsicht und -Verwaltung
 */

class DatabaseAdmin {
    constructor() {
        this.currentTables = [];
        this.currentTableData = null;
        this.currentPage = 1;
        this.perPage = 50;
        
        this.initEventListeners();
        this.loadInitialData();
    }

    initEventListeners() {
        // Refresh Button
        document.getElementById('refreshDataBtn').addEventListener('click', () => {
            this.loadInitialData();
        });

        // Backup Button
        document.getElementById('createBackupBtn').addEventListener('click', () => {
            this.createBackup();
        });

        // Query ausführen
        document.getElementById('executeQueryBtn').addEventListener('click', () => {
            this.executeQuery();
        });

        // Query leeren
        document.getElementById('clearQueryBtn').addEventListener('click', () => {
            document.getElementById('sqlQuery').value = '';
            document.getElementById('queryResults').innerHTML = '';
        });

        // Beispiel-Queries
        document.querySelectorAll('.example-query').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const query = e.target.getAttribute('data-query');
                document.getElementById('sqlQuery').value = query;
            });
        });

        // Tabellen-Auswahl
        document.getElementById('tableSelect').addEventListener('change', (e) => {
            const tableName = e.target.value;
            if (tableName) {
                this.loadTableData(tableName);
            } else {
                document.getElementById('tableDataContainer').innerHTML = '';
            }
        });

        // Tab-Wechsel
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const targetId = e.target.getAttribute('data-bs-target');
                if (targetId === '#table-data' && this.currentTables.length > 0) {
                    this.populateTableSelect();
                }
            });
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadDatabaseInfo(),
                this.loadTables()
            ]);
        } catch (error) {
            this.showError('Fehler beim Laden der Daten: ' + error.message);
        }
    }

    async loadDatabaseInfo() {
        try {
            const response = await fetch('/api/admin/database/info');
            const data = await response.json();

            if (data.success) {
                this.displayDatabaseInfo(data.database_info);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Datenbank-Informationen:', error);
            document.getElementById('databaseInfo').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Fehler: ${error.message}
                </div>
            `;
        }
    }

    displayDatabaseInfo(info) {
        const sizeInMB = (info.database_size / (1024 * 1024)).toFixed(2);
        
        document.getElementById('databaseInfo').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <ul class="list-unstyled mb-0">
                        <li><strong>Datenbankpfad:</strong> <code>${info.database_path}</code></li>
                        <li><strong>Dateigröße:</strong> ${sizeInMB} MB</li>
                        <li><strong>SQLite Version:</strong> ${info.sqlite_version}</li>
                    </ul>
                </div>
                <div class="col-md-6">
                    <ul class="list-unstyled mb-0">
                        <li><strong>Anzahl Tabellen:</strong> ${info.tables_count}</li>
                        <li><strong>Gesamtanzahl Zeilen:</strong> ${info.total_rows.toLocaleString()}</li>
                        <li><strong>Status:</strong> <span class="text-success"><i class="bi bi-check-circle me-1"></i>Verbunden</span></li>
                    </ul>
                </div>
            </div>
        `;
    }

    async loadTables() {
        try {
            const response = await fetch('/api/admin/database/tables');
            const data = await response.json();

            if (data.success) {
                this.currentTables = data.tables;
                this.displayTables(data.tables);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Tabellen:', error);
            document.getElementById('tablesOverview').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Fehler: ${error.message}
                </div>
            `;
        }
    }

    displayTables(tables) {
        if (tables.length === 0) {
            document.getElementById('tablesOverview').innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    Keine Tabellen gefunden.
                </div>
            `;
            return;
        }

        let html = '<div class="row">';
        
        tables.forEach(table => {
            const primaryKeys = table.columns.filter(col => col.primary_key).map(col => col.name);
            
            html += `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="card h-100">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${table.name}</h6>
                            <span class="badge bg-primary">${table.row_count} Zeilen</span>
                        </div>
                        <div class="card-body">
                            <h6>Spalten (${table.columns.length}):</h6>
                            <ul class="list-unstyled small">
                                ${table.columns.map(col => `
                                    <li class="d-flex justify-content-between">
                                        <span class="${col.primary_key ? 'fw-bold text-primary' : ''}">${col.name}</span>
                                        <span class="text-muted">${col.type}</span>
                                    </li>
                                `).join('')}
                            </ul>
                            ${primaryKeys.length > 0 ? `
                                <div class="mt-2">
                                    <small class="text-muted">Primary Key: ${primaryKeys.join(', ')}</small>
                                </div>
                            ` : ''}
                        </div>
                        <div class="card-footer">
                            <button class="btn btn-sm btn-outline-primary" onclick="databaseAdmin.viewTableData('${table.name}')">
                                <i class="bi bi-eye me-1"></i>Daten anzeigen
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        document.getElementById('tablesOverview').innerHTML = html;
    }

    populateTableSelect() {
        const select = document.getElementById('tableSelect');
        select.innerHTML = '<option value="">-- Tabelle auswählen --</option>';
        
        this.currentTables.forEach(table => {
            const option = document.createElement('option');
            option.value = table.name;
            option.textContent = `${table.name} (${table.row_count} Zeilen)`;
            select.appendChild(option);
        });
    }

    viewTableData(tableName) {
        // Wechsle zum Table Data Tab
        const tabElement = document.getElementById('table-data-tab');
        const tab = new bootstrap.Tab(tabElement);
        tab.show();
        
        // Setze die Tabelle in der Auswahl
        document.getElementById('tableSelect').value = tableName;
        
        // Lade die Daten
        this.loadTableData(tableName);
    }

    async loadTableData(tableName, page = 1) {
        try {
            this.currentPage = page;
            
            document.getElementById('tableDataContainer').innerHTML = `
                <div class="d-flex justify-content-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Lädt...</span>
                    </div>
                </div>
            `;

            const response = await fetch(`/api/admin/database/table/${tableName}?page=${page}&per_page=${this.perPage}`);
            const data = await response.json();

            if (data.success) {
                this.displayTableData(data);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Tabellendaten:', error);
            document.getElementById('tableDataContainer').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Fehler: ${error.message}
                </div>
            `;
        }
    }

    displayTableData(data) {
        const container = document.getElementById('tableDataContainer');
        
        if (data.rows.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    Tabelle "${data.table_name}" ist leer.
                </div>
            `;
            return;
        }

        let html = `
            <div class="mb-3 d-flex justify-content-between align-items-center">
                <h6>Tabelle: ${data.table_name}</h6>
                <span class="text-muted">
                    ${data.pagination.total_rows} Zeilen gesamt, 
                    Seite ${data.pagination.page} von ${data.pagination.total_pages}
                </span>
            </div>
            
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead class="table-dark">
                        <tr>
                            ${data.columns.map(col => `
                                <th scope="col">
                                    ${col.name}
                                    ${col.primary_key ? '<i class="bi bi-key ms-1 text-warning"></i>' : ''}
                                    <br><small class="text-muted">${col.type}</small>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.rows.map(row => `
                            <tr>
                                ${row.map(cell => `
                                    <td>
                                        <div class="cell-content" title="${this.escapeHtml(String(cell || ''))}">
                                            ${this.formatCellValue(cell)}
                                        </div>
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Paginierung hinzufügen
        if (data.pagination.total_pages > 1) {
            html += this.createPagination(data.pagination, data.table_name);
        }

        container.innerHTML = html;
    }

    createPagination(pagination, tableName) {
        const { page, total_pages } = pagination;
        
        let html = '<nav><ul class="pagination justify-content-center">';
        
        // Vorherige Seite
        html += `
            <li class="page-item ${page === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="databaseAdmin.loadTableData('${tableName}', ${page - 1})">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;
        
        // Seitenzahlen
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(total_pages, page + 2);
        
        if (startPage > 1) {
            html += `<li class="page-item"><a class="page-link" href="#" onclick="databaseAdmin.loadTableData('${tableName}', 1)">1</a></li>`;
            if (startPage > 2) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === page ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="databaseAdmin.loadTableData('${tableName}', ${i})">${i}</a>
                </li>
            `;
        }
        
        if (endPage < total_pages) {
            if (endPage < total_pages - 1) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
            html += `<li class="page-item"><a class="page-link" href="#" onclick="databaseAdmin.loadTableData('${tableName}', ${total_pages})">${total_pages}</a></li>`;
        }
        
        // Nächste Seite
        html += `
            <li class="page-item ${page === total_pages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="databaseAdmin.loadTableData('${tableName}', ${page + 1})">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;
        
        html += '</ul></nav>';
        return html;
    }

    async executeQuery() {
        const query = document.getElementById('sqlQuery').value.trim();
        
        if (!query) {
            this.showError('Bitte geben Sie eine SQL-Query ein.');
            return;
        }

        try {
            document.getElementById('queryResults').innerHTML = `
                <div class="d-flex justify-content-center">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Lädt...</span>
                    </div>
                </div>
            `;

            const response = await fetch('/api/admin/database/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: query })
            });

            const data = await response.json();

            if (data.success) {
                this.displayQueryResults(data);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Fehler beim Ausführen der Query:', error);
            document.getElementById('queryResults').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    <strong>Query-Fehler:</strong> ${error.message}
                </div>
            `;
        }
    }

    displayQueryResults(data) {
        const container = document.getElementById('queryResults');
        
        if (data.rows.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    Query ausgeführt. Keine Ergebnisse zurückgegeben.
                    <br><small class="text-muted">Query: ${this.escapeHtml(data.query)}</small>
                </div>
            `;
            return;
        }

        let html = `
            <div class="alert alert-success">
                <i class="bi bi-check-circle me-2"></i>
                Query erfolgreich ausgeführt. ${data.row_count} Zeilen zurückgegeben.
                <br><small class="text-muted">Query: ${this.escapeHtml(data.query)}</small>
            </div>
            
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead class="table-dark">
                        <tr>
                            ${data.columns.map(col => `<th scope="col">${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.rows.map(row => `
                            <tr>
                                ${row.map(cell => `
                                    <td>
                                        <div class="cell-content" title="${this.escapeHtml(String(cell || ''))}">
                                            ${this.formatCellValue(cell)}
                                        </div>
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    }

    async createBackup() {
        try {
            document.getElementById('createBackupBtn').disabled = true;
            document.getElementById('createBackupBtn').innerHTML = `
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                Erstelle Backup...
            `;

            const response = await fetch('/api/admin/database/backup', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess(data.message);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Fehler beim Erstellen des Backups:', error);
            this.showError('Backup-Fehler: ' + error.message);
        } finally {
            document.getElementById('createBackupBtn').disabled = false;
            document.getElementById('createBackupBtn').innerHTML = `
                <i class="bi bi-download me-2"></i>Backup erstellen
            `;
        }
    }

    formatCellValue(value) {
        if (value === null || value === undefined) {
            return '<span class="text-muted fst-italic">NULL</span>';
        }
        
        if (typeof value === 'string' && value.length > 100) {
            return this.escapeHtml(value.substring(0, 100)) + '<span class="text-muted">...</span>';
        }
        
        return this.escapeHtml(String(value));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccess(message) {
        const toast = document.getElementById('successToast');
        document.getElementById('successToastBody').textContent = message;
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }

    showError(message) {
        const toast = document.getElementById('errorToast');
        document.getElementById('errorToastBody').textContent = message;
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
}

// Initialisierung
let databaseAdmin;

document.addEventListener('DOMContentLoaded', function() {
    databaseAdmin = new DatabaseAdmin();
});

// CSS für bessere Darstellung der Tabellenzellen
const style = document.createElement('style');
style.textContent = `
    .cell-content {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .table th, .table td {
        vertical-align: middle;
    }
    
    .table th small {
        font-weight: normal;
        opacity: 0.8;
    }
`;
document.head.appendChild(style);
