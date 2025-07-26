// js/order-management.js
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

class OrderManagement {
    constructor() {
        this.currentUser = null;
        this.restaurantId = 'restaurant_1';
        this.ordersRef = collection(db, `restaurants/${this.restaurantId}/orders`);
        this.allOrders = [];
        this.filteredOrders = [];
        this.currentFilter = 'all';
        this.deleteOrderId = null;
        this.deleteOrderNumber = null;
        this.init();
    }

    init() {
        this.setupAuthListener();
        this.setupEventListeners();
        this.updateCurrentDate();
    }

    setupAuthListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.displayUserInfo();
                this.loadOrders();
            } else {
                window.location.href = '../index.html';
            }
        });
    }

    setupEventListeners() {
        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = '../index.html';
            } catch (error) {
                console.error('Logout failed:', error);
            }
        });

        // Filters
        document.getElementById('status-filter').addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.filterAndDisplayOrders();
        });

        document.getElementById('search-orders').addEventListener('input', () => {
            this.filterAndDisplayOrders();
        });

        document.getElementById('refresh-orders').addEventListener('click', () => {
            this.showRefreshFeedback();
        });

        // Modal events
        document.getElementById('cancel-delete').addEventListener('click', () => {
            this.hideDeleteModal();
        });

        document.getElementById('confirm-delete').addEventListener('click', () => {
            this.confirmDelete();
        });

        document.getElementById('modal-close').addEventListener('click', () => {
            this.hideDeleteModal();
        });

        // Close modal on outside click
        document.getElementById('delete-modal').addEventListener('click', (e) => {
            if (e.target.id === 'delete-modal') {
                this.hideDeleteModal();
            }
        });

        // Export functionality
        document.getElementById('export-orders').addEventListener('click', () => {
            this.exportOrders();
        });
    }

    displayUserInfo() {
        const userEmailElement = document.getElementById('user-email');
        if (userEmailElement && this.currentUser) {
            userEmailElement.textContent = this.currentUser.email;
        }
    }

    updateCurrentDate() {
        // This function can be used if you have a date display element
        console.log('Current date updated');
    }

    loadOrders() {
        const ordersQuery = query(this.ordersRef, orderBy('timestamp', 'desc'));
        
        onSnapshot(ordersQuery, (snapshot) => {
            this.allOrders = [];
            snapshot.forEach((doc) => {
                this.allOrders.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log('✅ Orders loaded:', this.allOrders.length);
            this.updateStats();
            this.filterAndDisplayOrders();
        }, (error) => {
            console.error('❌ Error loading orders:', error);
            this.showError('Failed to load orders');
        });
    }

    updateStats() {
        const totalOrders = this.allOrders.length;
        const pendingOrders = this.allOrders.filter(order => order.status === 'pending').length;
        
        document.getElementById('total-orders').textContent = totalOrders;
        document.getElementById('pending-orders').textContent = pendingOrders;
    }

    filterAndDisplayOrders() {
        const searchTerm = document.getElementById('search-orders').value.toLowerCase();
        
        this.filteredOrders = this.allOrders.filter(order => {
            // Filter by status
            const statusMatch = this.currentFilter === 'all' || order.status === this.currentFilter;
            
            // Filter by search term
            const searchMatch = !searchTerm || 
                (order.orderNumber && order.orderNumber.toString().includes(searchTerm)) ||
                (order.tableNumber && order.tableNumber.toLowerCase().includes(searchTerm)) ||
                (order.items && order.items.some(item => 
                    item.name && item.name.toLowerCase().includes(searchTerm)
                ));
            
            return statusMatch && searchMatch;
        });
        
        this.displayOrders();
    }

    displayOrders() {
        const container = document.getElementById('orders-container');
        
        if (this.filteredOrders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="clipboard-list" class="empty-icon"></i>
                    <h3>No Orders Found</h3>
                    <p>No orders match your current filters</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        container.innerHTML = this.filteredOrders.map(order => this.createOrderCard(order)).join('');
        lucide.createIcons();
        
        // Attach event listeners to buttons
        this.attachOrderEventListeners();
    }

    createOrderCard(order) {
        const timeAgo = this.getTimeAgo(order.timestamp);
        const statusClass = order.status || 'pending';
        
        return `
            <div class="order-card status-${statusClass}">
                <div class="order-header">
                    <div class="order-info">
                        <div class="table-number">Table ${order.tableNumber || 'N/A'}</div>
                        <div class="order-number">Order #${order.orderNumber || 'N/A'}</div>
                        <div class="order-time">${timeAgo}</div>
                    </div>
                    <div class="order-status">
                        <span class="status-badge status-${statusClass}">${statusClass}</span>
                    </div>
                </div>
                
                <div class="order-items">
                    ${order.items ? order.items.map(item => `
                        <div class="order-item">
                            <div class="item-details">
                                <span class="item-qty">${item.quantity || item.qty || 1}</span>
                                <span class="item-name">${item.name}</span>
                            </div>
                            <span class="item-price">₹${item.price || 0}</span>
                        </div>
                    `).join('') : '<p>No items found</p>'}
                </div>
                
                <div class="order-footer">
                    <div class="order-total">Total: ₹${order.total || 0}</div>
                    <div class="order-actions">
                        ${this.getActionButtons(order)}
                    </div>
                </div>
            </div>
        `;
    }

    getActionButtons(order) {
        let buttons = '';
        
        // Status progression buttons
        if (order.status === 'pending') {
            buttons += `<button class="action-btn btn-preparing" data-id="${order.id}" data-status="preparing">
                <i data-lucide="chef-hat"></i> Start Preparing
            </button>`;
        } else if (order.status === 'preparing') {
            buttons += `<button class="action-btn btn-ready" data-id="${order.id}" data-status="ready">
                <i data-lucide="check-circle"></i> Mark Ready
            </button>`;
        } else if (order.status === 'ready') {
            buttons += `<button class="action-btn btn-complete" data-id="${order.id}" data-status="completed">
                <i data-lucide="package-check"></i> Complete
            </button>`;
        }
        
        // Delete button (always available for admin)
        buttons += `<button class="action-btn btn-delete" data-id="${order.id}" data-order="${order.orderNumber || 'N/A'}">
            <i data-lucide="trash-2"></i> Delete
        </button>`;
        
        return buttons;
    }

    attachOrderEventListeners() {
        // Status update buttons
        document.querySelectorAll('.btn-preparing, .btn-ready, .btn-complete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.target.closest('button').dataset.id;
                const newStatus = e.target.closest('button').dataset.status;
                this.updateOrderStatus(orderId, newStatus);
            });
        });
        
        // Delete buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.target.closest('button').dataset.id;
                const orderNumber = e.target.closest('button').dataset.order;
                this.showDeleteModal(orderId, orderNumber);
            });
        });
    }

    async updateOrderStatus(orderId, newStatus) {
        try {
            await updateDoc(doc(this.ordersRef, orderId), {
                status: newStatus,
                updatedAt: Timestamp.now()
            });
            
            console.log(`✅ Order ${orderId} updated to ${newStatus}`);
            this.showSuccessMessage(`Order status updated to ${newStatus}`);
        } catch (error) {
            console.error('❌ Error updating order status:', error);
            this.showError('Failed to update order status');
        }
    }

    showDeleteModal(orderId, orderNumber) {
        this.deleteOrderId = orderId;
        this.deleteOrderNumber = orderNumber;
        document.getElementById('delete-message').textContent = 
            `Are you sure you want to delete Order #${orderNumber}?`;
        document.getElementById('delete-modal').classList.add('active');
    }

    hideDeleteModal() {
        document.getElementById('delete-modal').classList.remove('active');
        this.deleteOrderId = null;
        this.deleteOrderNumber = null;
    }

    async confirmDelete() {
        if (!this.deleteOrderId) return;
        
        try {
            await deleteDoc(doc(this.ordersRef, this.deleteOrderId));
            console.log(`✅ Order ${this.deleteOrderId} deleted successfully`);
            
            // Show success message
            this.showSuccessMessage(`Order #${this.deleteOrderNumber} deleted successfully`);
            
            this.hideDeleteModal();
        } catch (error) {
            console.error('❌ Error deleting order:', error);
            this.showError('Failed to delete order');
        }
    }

    showRefreshFeedback() {
        const refreshBtn = document.getElementById('refresh-orders');
        const originalText = refreshBtn.innerHTML;
        
        refreshBtn.innerHTML = '<i data-lucide="loader-2" class="spinning"></i> Refreshing...';
        refreshBtn.disabled = true;
        
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
            lucide.createIcons();
            this.showSuccessMessage('Orders refreshed successfully');
        }, 1000);
    }

    exportOrders() {
        try {
            const dataToExport = this.filteredOrders.map(order => ({
                'Order Number': order.orderNumber || 'N/A',
                'Table Number': order.tableNumber || 'N/A',
                'Status': order.status || 'pending',
                'Total Amount': order.total || 0,
                'Items': order.items ? order.items.map(item => `${item.quantity || 1}x ${item.name}`).join(', ') : '',
                'Created At': order.timestamp ? order.timestamp.toDate().toLocaleString() : 'Unknown'
            }));
            
            const csv = this.convertToCSV(dataToExport);
            this.downloadCSV(csv, `orders_${new Date().toISOString().split('T')[0]}.csv`);
            
            this.showSuccessMessage('Orders exported successfully');
        } catch (error) {
            console.error('❌ Error exporting orders:', error);
            this.showError('Failed to export orders');
        }
    }

    convertToCSV(data) {
        if (!data || data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
        ].join('\n');
        
        return csvContent;
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    getTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown time';
        
        const now = new Date();
        const orderTime = timestamp.toDate();
        const diffInMinutes = Math.floor((now - orderTime) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        
        return orderTime.toLocaleDateString();
    }

    showSuccessMessage(message) {
        // Simple success feedback - you can enhance this with toast notifications
        console.log('✅ Success:', message);
        
        // Create a temporary success indicator
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 1001;
            font-weight: 600;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        // Animate in
        setTimeout(() => {
            successDiv.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            successDiv.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(successDiv);
            }, 300);
        }, 3000);
    }

    showError(message) {
        console.error('❌ Error:', message);
        
        // Create a temporary error indicator
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 1001;
            font-weight: 600;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        // Animate in
        setTimeout(() => {
            errorDiv.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            errorDiv.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(errorDiv);
            }, 300);
        }, 4000);
    }
}

// Initialize Order Management
const orderManagement = new OrderManagement();
console.log('🚀 Order Management System loaded successfully!');
