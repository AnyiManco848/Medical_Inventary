import TableLabels from './_components/TableLabels';

export default function DashboardLayout({ children }) {
  return (
    <>
      <TableLabels />
      {children}
    </>
  );
}
