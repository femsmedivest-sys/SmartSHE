document.addEventListener('DOMContentLoaded', function() {
    // Array gambar untuk hero section
    const heroImages = [
        'Ambulance_1.webp',
        'Ambulance_2.webp',
        'Ambulance_3.webp'
    ];
    
    let currentImageIndex = 0;
    const heroSection = document.querySelector('.hero');
    
    // Fungsi untuk menukar gambar hero
    function changeHeroImage() {
        currentImageIndex = (currentImageIndex + 1) % heroImages.length;
        heroSection.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${heroImages[currentImageIndex]}')`;
    }
    
    // Tukar gambar setiap 5 saat
    setInterval(changeHeroImage, 5000);
    
    // Harga asas untuk setiap pakej
    const basePrices = {
        basic: 150,
        premium: 250,
        luxury: 400
    };

// Fungsi untuk mengira jumlah harga dengan add-ons
    function calculateTotal(packageType) {
        let total = basePrices[packageType];
        
        // Dapatkan semua checkbox untuk pakej ini
        const card = document.querySelector(`.activity-card:nth-child(${packageType === 'basic' ? 1 : packageType === 'premium' ? 2 : 3})`);
        const checkboxes = card.querySelectorAll('input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                total += parseInt(checkbox.dataset.price);
            }
        });
        
        // Update jumlah harga
        document.getElementById(`total-${packageType}`).textContent = total;
        
        return total;
    }

// Tambah event listener untuk semua checkbox add-ons
    document.querySelectorAll('.add-on-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Dapatkan jenis pakej dari parent card position
            const card = this.closest('.activity-card');
            const cards = document.querySelectorAll('.activity-card');
            const cardIndex = Array.from(cards).indexOf(card);
            
            let packageType;
            if (cardIndex === 0) packageType = 'basic';
            else if (cardIndex === 1) packageType = 'premium';
            else packageType = 'luxury';
            
            calculateTotal(packageType);
        });
    });
    
    // Fungsi untuk menambah ke cart
    window.addToCart = function(packageType) {
        const total = calculateTotal(packageType);
        
        // Dapatkan nama pakej
        let packageName = '';
        switch(packageType) {
            case 'basic':
                packageName = 'Ambulans Basic';
                break;
            case 'premium':
                packageName = 'Ambulans Premium';
                break;
            case 'luxury':
                packageName = 'Ambulans Luxury';
                break;
        }
        
        // Dapatkan add-ons yang dipilih
        const selectedAddOns = [];
        const checkboxes = document.querySelectorAll(`#${packageType} input[type="checkbox"]`);
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedAddOns.push(checkbox.nextElementSibling.textContent.trim());
            }
        });
        
        // Simulasi menambah ke cart
        showNotification(`Pakej ${packageName} berjaya ditambah ke tempahan! Jumlah: RM ${total}`, 'success');
        
        // Reset form selepas menambah ke cart
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        calculateTotal(packageType);
    };
    
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Update active link
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });

    // Header background on scroll
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            header.style.background = 'rgba(255, 255, 255, 0.98)';
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.boxShadow = 'none';
        }
    });

    // Mobile menu toggle
    const mobileMenu = document.querySelector('.mobile-menu');
    const navLinksContainer = document.querySelector('.nav-links');
    
    mobileMenu.addEventListener('click', function() {
        navLinksContainer.style.display = 
            navLinksContainer.style.display === 'flex' ? 'none' : 'flex';
    });

    // Activity card animations
    const activityCards = document.querySelectorAll('.activity-card');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    activityCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Gallery image modal
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    galleryItems.forEach(item => {
        item.addEventListener('click', function() {
            const imgSrc = this.querySelector('img').src;
            const imgAlt = this.querySelector('img').alt;
            
            // Create modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                cursor: pointer;
            `;
            
            const modalImg = document.createElement('img');
            modalImg.src = imgSrc;
            modalImg.alt = imgAlt;
            modalImg.style.cssText = `
                max-width: 90%;
                max-height: 90%;
                object-fit: contain;
                border-radius: 8px;
            `;
            
            modal.appendChild(modalImg);
            document.body.appendChild(modal);
            
            // Close modal on click
            modal.addEventListener('click', function() {
                document.body.removeChild(modal);
            });
            
            // Close modal on ESC key
            document.addEventListener('keydown', function closeModal(e) {
                if (e.key === 'Escape') {
                    document.body.removeChild(modal);
                    document.removeEventListener('keydown', closeModal);
                }
            });
        });
    });

    // Form submission
    const contactForm = document.querySelector('.contact-form form');
    
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this);
        const name = formData.get('name') || this.querySelector('input[type="text"]').value;
        const email = formData.get('email') || this.querySelector('input[type="email"]').value;
        const message = formData.get('message') || this.querySelector('textarea').value;
        
        // Simple validation
        if (!name || !email || !message) {
            showNotification('Sila isi semua maklumat yang diperlukan.', 'error');
            return;
        }
        
        // Simulate form submission
        showNotification('Terima kasih! Pertanyaan anda telah dihantar.', 'success');
        this.reset();
    });

    // Notification function
    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 3000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // Counter animation for stats
    const statNumbers = document.querySelectorAll('.stat-number');
    
    function animateCounter(element, target) {
        let current = 0;
        const increment = target / 100;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target + (element.textContent.includes('+') ? '+' : '');
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(current) + (element.textContent.includes('+') ? '+' : '');
            }
        }, 20);
    }
    
    const statsObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.textContent);
                animateCounter(entry.target, target);
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    statNumbers.forEach(stat => {
        statsObserver.observe(stat);
    });

    // Update active nav link based on scroll position
    function updateActiveNavLink() {
        const sections = document.querySelectorAll('section');
        const headerHeight = header.offsetHeight;
        
        let currentSection = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - headerHeight - 100;
            const sectionBottom = sectionTop + section.offsetHeight;
            
            if (window.scrollY >= sectionTop && window.scrollY < sectionBottom) {
                currentSection = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    }
    
    window.addEventListener('scroll', updateActiveNavLink);

    // Add loading animation
    window.addEventListener('load', function() {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            document.body.style.opacity = '1';
        }, 100);
    });
});

// Handle window resize untuk optimization mobile
window.addEventListener('resize', function() {
    const heroStats = document.querySelector('.hero-stats');
    if (window.innerWidth <= 480) {
        heroStats.style.flexDirection = 'row';
        heroStats.style.flexWrap = 'wrap';
    }
});

// Initialize pada load
window.addEventListener('load', function() {
    if (window.innerWidth <= 480) {
        const heroStats = document.querySelector('.hero-stats');
        heroStats.style.flexDirection = 'row';
        heroStats.style.flexWrap = 'wrap';
    }
});