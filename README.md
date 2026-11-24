# MakChat - Makerere Student Network

MakChat is the exclusive social network designed for the modern Makerere University student community. It combines social interaction, campus utility, and a student-driven marketplace into a single, high-performance web experience.

## 🚀 Key Features

- **The Curia**: A time-locked anonymous space (8 PM - 1 AM) for students to speak their truth. Data wipes at dawn.
- **MakMart**: A specialized marketplace for campus-wide buying, leasing, and service offerings.
- **MakNews**: A modular news platform for verified campus journalism and real-time updates with video support.
- **Gig Board**: A peer-to-peer freelance board for campus tasks and student jobs.
- **Cafeteria Menus**: Live daily menus from campus canteens and dining halls.
- **Lost & Found**: A community-driven system to recover lost items across campus.
- **Secure Messaging**: Full direct messaging suite with media support and presence tracking.
- **Campus Admin**: A developer-level Command Center for moderation and platform control.

## 🛠 Tech Stack

- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router), [React 18](https://reactjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/)
- **Backend**: [Firebase](https://firebase.google.com/) (Authentication, Firestore, Storage, Cloud Messaging)
- **Deployment**: [Firebase App Hosting](https://firebase.google.com/docs/app-hosting)
- **Icons**: [Lucide React](https://lucide.dev/)

## 📦 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A Firebase Project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/makchat.git
   cd makchat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory and add your Firebase credentials:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Built with ❤️ for Makerere University.
