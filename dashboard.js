// js/dashboard.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

class DashboardManager {
  constructor() {
    this.currentUser = null;
    this.salesChart = null;
    this.init();
  }

  init() {
    this.setupAuthListener();
    this.setupEventListeners();
    this.updateCurrentDate();
    this.initializeSalesChart();
  }

  setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.displayUserInfo();
        this.loadDashboardData();
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

    // Chart period controls
    document.querySelectorAll('.control-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.updateSalesChart(e.target.dataset.period);
      });
    });
  }

  displayUserInfo() {
    const el = document.getElementById('user-email');
    if (el && this.currentUser) el.textContent = this.currentUser.email;
  }

  updateCurrentDate() {
    const el = document.getElementById('current-date');
    const now = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    el.textContent = now.toLocaleDateString('en-US', opts);
  }

  async loadDashboardData() {
    try {
      await this.loadTodayMetrics();
      await this.loadPopularItems();
      await this.loadRecentOrders();
      console.log('✅ Dashboard data loaded');
    } catch (e) {
      console.error('Error loading dashboard:', e);
    }
  }

  async loadTodayMetrics() {
    // Placeholder sample data
    const sample = { revenue: 15750, orders: 42, customers: 38, rating: 4.8 };
    document.getElementById('today-revenue').textContent = `₹${sample.revenue.toLocaleString()}`;
    document.getElementById('today-orders').textContent = sample.orders;
    document.getElementById('active-customers').textContent = sample.customers;
    document.getElementById('avg-rating').textContent = sample.rating;
  }

  async loadPopularItems() {
    const container = document.getElementById('popular-items');
    const items = [
      { name: 'Butter Chicken', sales: 25 },
      { name: 'Paneer Tikka',   sales: 18 },
      { name: 'Chicken Biryani', sales: 15 },
      { name: 'Dal Makhani',     sales: 12 },
      { name: 'Garlic Naan',     sales: 20 }
    ];
    container.innerHTML = items.map(i => `
      <div class="popular-item">
        <span class="item-name">${i.name}</span>
        <span class="item-sales">${i.sales} sold</span>
      </div>
    `).join('');
  }

  async loadRecentOrders() {
    const container = document.getElementById('recent-orders');
    container.innerHTML = `
      <div class="order-placeholder">
        <i data-lucide="loader-2" class="spinning"></i>
        Loading recent orders...
      </div>
    `;

    try {
      const ordersRef = collection(db, 'restaurants/restaurant_1/orders');
      const q = query(ordersRef, orderBy('timestamp', 'desc'), limit(5));

      onSnapshot(q, (snap) => {
        if (snap.empty) {
          container.innerHTML = `
            <div class="order-placeholder">
              <i data-lucide="coffee"></i>
              No recent orders yet
            </div>
          `;
          lucide.createIcons();
          return;
        }

        container.innerHTML = snap.docs.map(doc => {
          const o = doc.data();
          const timeAgo = this.getTimeAgo(o.timestamp);
          const tableNumber = o.tableNumber || 'N/A';
          const orderNumber = o.orderNumber || 'N/A';
          const status = o.status || 'pending';
          const total = o.total || 0;

          return `
            <div class="recent-order">
              <div class="order-info">
                <div class="order-header-info">
                  <span class="order-id">Order #${orderNumber}</span>
                  <span class="table-info">Table ${tableNumber}</span>
                </div>
                <span class="order-time">${timeAgo}</span>
              </div>
              <div class="order-amount-info">
                <span class="order-amount">₹${total}</span>
                <span class="order-status status-${status}">${status}</span>
              </div>
            </div>`;
        }).join('');
        lucide.createIcons();
      }, (err) => {
        console.error('Error loading recent orders:', err);
        container.innerHTML = `
          <div class="order-placeholder">
            <i data-lucide="alert-circle"></i>
            Failed to load orders
          </div>
        `;
        lucide.createIcons();
      });
    } catch (e) {
      console.error('Error in loadRecentOrders:', e);
      container.innerHTML = `
        <div class="order-placeholder">
          <i data-lucide="alert-circle"></i>
          Failed to load orders
        </div>
      `;
      lucide.createIcons();
    }
  }

  getTimeAgo(ts) {
    if (!ts) return 'Unknown';
    const now = new Date();
    const past = ts.toDate();
    const diffM = Math.floor((now - past) / 60000);
    if (diffM < 1) return 'Just now';
    if (diffM < 60) return `${diffM} min ago`;
    const diffH = Math.floor(diffM / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return past.toLocaleDateString();
  }

  initializeSalesChart() {
    const ctx = document.getElementById('sales-chart').getContext('2d');
    const data = {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets: [{
        label: 'Revenue',
        data: [12000,15000,8000,18000,22000,25000,20000],
        backgroundColor: 'rgba(49,130,206,0.1)',
        borderColor: '#3182ce',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      }]
    };
    this.salesChart = new Chart(ctx, {
      type: 'line', data,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => '₹'+v.toLocaleString() } } },
        elements: { point: { radius: 6, hoverRadius: 8 } }
      }
    });
  }

  updateSalesChart(period) {
    const periods = {
      '7': { labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], data:[12000,15000,8000,18000,22000,25000,20000] },
      '30': { labels:['Week 1','Week 2','Week 3','Week 4'], data:[85000,92000,78000,95000] },
      '90': { labels:['Month 1','Month 2','Month 3'], data:[350000,380000,420000] }
    };
    const sel = periods[period];
    this.salesChart.data.labels = sel.labels;
    this.salesChart.data.datasets[0].data = sel.data;
    this.salesChart.update();
  }
}

const dashboardManager = new DashboardManager();
console.log('🚀 Restaurant Dashboard loaded successfully!');
