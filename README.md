# EasyCare - Vehicle Management System

EasyCare is a comprehensive and intelligent vehicle management dashboard designed to help users track, manage, and optimize all aspects of their vehicle's lifecycle. 

## 🌟 Key Features

- **Dashboard Overview:** Get a quick glance at your vehicle's status, reliability score, mileage, and active alerts.
- **Smart AI Assistant:** Integrated AI chatbot (powered by Google Gemini) that understands your vehicle's context and provides expert mechanical advice.
- **Fuel Tracking & Analytics:** Log fuel expenses, track price per unit, and calculate total costs automatically.
- **Maintenance & Treatments:** Keep a detailed history of garage visits, costs, and upload invoices.
- **Expense & Insurance Management:** Track general car expenses, insurance policies (mandatory, comprehensive, third-party), and manage renewals.
- **Accidents & Reports Handling:** Document accidents, view reports, upload related documents, and manage traffic fines.
- **Global Search & Public Reports:** Look up vehicles via license plate or manufacturer for public-facing reports.
- **User Authentication:** Secure registration and login flow with session management.

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (Responsive design, based on HTML5 UP Helios).
- **Backend:** Node.js, Express.js.
- **Database:** Microsoft SQL Server (Azure SQL).
- **AI Integration:** Google Generative AI (Gemini Flash).

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v14 or newer recommended)
- SQL Server instance (or access to an Azure SQL Database)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/RazielBiton/Final_Project.git
   cd Final_Project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory and configure your database and API keys:
   ```env
   DB_USER=your_db_username
   DB_PASSWORD=your_db_password
   DB_SERVER=your_db_server_url
   DB_DATABASE=your_db_name
   GEMINI_API_KEY=your_google_gemini_api_key
   ```

4. **Database Initialization:**
   Ensure your database schema is set up. You can refer to `database_setup.sql` or use the setup scripts:
   ```bash
   node check_db.js
   node migrate.js
   ```

5. **Run the server:**
   ```bash
   npm start
   ```

6. **Access the application:**
   Open your browser and navigate to `http://localhost:3000`.

## 📂 Project Structure

- `server.js`: The main Express server file handling API routes and backend logic.
- `db.js`: Handles database connection pooling and configuration.
- `dashboard.html`, `login.html`, `index.html`: Main frontend interfaces.
- `/css/`, `/js/`, `/images/`: Static assets housing styles, logic, and graphics.
- `/components/`: Reusable HTML/JS components.

## 📄 License & Credits

- Template Base: [Helios by HTML5 UP](https://html5up.net/) (CCA 3.0 license).
- EasyCare Custom Implementations: Final Project Team.
