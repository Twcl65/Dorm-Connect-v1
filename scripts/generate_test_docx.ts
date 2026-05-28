import { buildDocxReport } from "../app/api/landlord/reports/_docx";
import * as fs from 'fs';

(async () => {
  const buffer = await buildDocxReport({
    title: "Room Information Report",
    subtitle: "Room status, tenant assignment (when available), and room/listing details.",
    columns: [
      { key: "roomNo", label: "Room No." },
      { key: "capacity", label: "Capacity" },
      { key: "rate", label: "Rate (₱/month)" },
      { key: "roomStatus", label: "Room Status" },
      { key: "isListed", label: "Listed" },
      { key: "tenantName", label: "Tenant Name" },
      { key: "leasePeriod", label: "Lease Period" },
      { key: "paymentStatus", label: "Payment Status" },
      { key: "roomSizeLabel", label: "Room Size" },
      { key: "listingLocation", label: "Listing Location" },
      { key: "listingDescription", label: "Listing Description" },
      { key: "roomDetails", label: "Room Details" },
    ],
    rows: [
      {
        roomNo: "101",
        capacity: 4,
        rate: 5500,
        roomStatus: "Occupied",
        isListed: "No",
        tenantName: "John Doe, Jane Smith",
        leasePeriod: "Jan 2026 - Dec 2026",
        paymentStatus: "Paid",
        roomSizeLabel: "25 sqm",
        listingLocation: "Building A, 1st Floor",
        listingDescription: "Spacious four-sharing room with private bathroom and Wi-Fi.",
        roomDetails: "Double-deck beds, premium mattresses, direct aircon.",
      },
      {
        roomNo: "102-B",
        capacity: 2,
        rate: 7000,
        roomStatus: "Available",
        isListed: "Yes",
        tenantName: "",
        leasePeriod: "",
        paymentStatus: "",
        roomSizeLabel: "18 sqm",
        listingLocation: "Building A, 1st Floor",
        listingDescription: "Cozy two-sharing room with aircon and study tables.",
        roomDetails: "Two single beds, cabinets, garden-facing window.",
      },
      {
        roomNo: "103",
        capacity: 3,
        rate: 6000,
        roomStatus: "Occupied",
        isListed: "No",
        tenantName: "Maria Santos",
        leasePeriod: "Mar 2026 - Feb 2027",
        paymentStatus: "Pending",
        roomSizeLabel: "20 sqm",
        listingLocation: "Building B, Ground Floor",
        listingDescription: "Three-sharing room near the common area.",
        roomDetails: "One double-deck and one single bed.",
      },
    ],
  });
  fs.writeFileSync('test_report.docx', buffer);
  console.log('Docx generated: test_report.docx');
})();
