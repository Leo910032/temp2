// app/investor-dashboard/layout.jsx
import '../../app/globals.css';

export const metadata = {
  title: 'Tapit SAS - Projections Financières',
  description: 'Dashboard des projections financières pour investisseurs - Tapit SAS',
};

export default function InvestorDashboardLayout({ children }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
