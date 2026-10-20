import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { formatTimeIST, formatDateIST, humanizeDuration, numberToWordsINR } from "./formatters";
import { VEHICLE_TYPE_CONFIG, UPI_CONFIG } from "./constants";
import { getDictionary, type Language } from "./i18n";

export interface PdfBillSessionData {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  driverNumber: string;
  driverName?: string | null;
  notes?: string | null;
  entryAt: string;
  exitAt?: string | null;
  durationMinutes?: number | null;
  grossAmount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  receiptNumber?: string | null;
  entryOperatorName?: string | null;
  exitOperatorName?: string | null;
  site?: any; // To avoid circular dependency with database.types.ts
}

/**
 * High-res pixel-perfect PDF export from DOM preview element
 */
export async function downloadElementAsPdf(elementId: string, filename: string, returnFileOnly = false): Promise<File | boolean> {
  const element = document.getElementById(elementId);
  if (!element) return false;

  try {
    const canvas = await html2canvas(element, {
      scale: 3, // Ultra HD capture
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 1200,
    } as any);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));
    if (returnFileOnly) {
      const blob = pdf.output("blob");
      return new File([blob], filename, { type: "application/pdf" });
    } else {
      pdf.save(filename);
      return true;
    }
  } catch (e) {
    console.error("DOM PDF Export failed:", e);
    return false;
  }
}

/**
 * Utility to load an image URL as base64 data URL for jsPDF embedding
 */
async function getBase64ImageFromUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Programmatic PDF bill generator (expanded for full A4 proportions)
 */
export async function generatePdfBill(
  session: PdfBillSessionData, 
  returnFileOnly?: boolean | "base64",
  layout: "a4" | "thermal" = "a4",
  type: "entry" | "exit" = "exit",
  lang: Language = "en"
): Promise<File | string | void> {
  const dict = getDictionary(lang);
  const isThermal = layout === "thermal";
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: isThermal ? [80, 160] : "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  if (isThermal) {
    let y = 10;
    
    const brandName = session.site?.brand_name || session.site?.name || "SANT WAMANBHAU";
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(brandName.toUpperCase(), pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text(dict.pdf.parking.toUpperCase(), pageWidth / 2, y, { align: "center" });
    
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const addressLine = session.site?.address ? `${session.site.address} • ${session.site.city}` : "The East Palace • Ahilyanagar";
    doc.text(addressLine, pageWidth / 2, y, { align: "center" });
    y += 4;
    const contactNo = session.site?.contact_number || UPI_CONFIG.mobile;
    doc.text(`${dict.pdf.helpline} ${contactNo}`, pageWidth / 2, y, { align: "center" });
    
    y += 6;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(5, y, pageWidth - 5, y);
    doc.setLineDashPattern([], 0);
    
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(type === "entry" ? dict.pdf.entryTicket.toUpperCase() : dict.pdf.exitReceipt.toUpperCase(), pageWidth / 2, y, { align: "center" });
    
    y += 4;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(5, y, pageWidth - 5, y);
    doc.setLineDashPattern([], 0);
    
    y += 8;
    const recNo = session.receiptNumber || `SWP-${session.id.slice(-6).toUpperCase()}`;
    const durationMin = session.durationMinutes || Math.floor((Date.now() - new Date(session.entryAt).getTime()) / 60000);
    const amountRs = (session.grossAmount || 0) / 100;
    const vConfig = VEHICLE_TYPE_CONFIG[session.vehicleType as keyof typeof VEHICLE_TYPE_CONFIG];
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    
    const printRow = (label: string, value: string) => {
      doc.setFont("helvetica", "normal");
      doc.text(label, 5, y);
      doc.setFont("helvetica", "bold");
      doc.text(value, pageWidth - 5, y, { align: "right" });
      y += 6;
    };
    
    printRow(dict.pdf.receiptNo, recNo);
    printRow(dict.pdf.date, formatDateIST(session.exitAt || session.entryAt));
    printRow(dict.pdf.vehicleNo, session.vehicleNumber.toUpperCase());
    printRow(dict.pdf.category, vConfig?.label || session.vehicleType);
    if (session.driverName) {
      printRow(dict.pdf.driverName, session.driverName);
    }
    if (session.driverNumber) {
      printRow(dict.pdf.driverPhone, session.driverNumber);
    }
    printRow(dict.pdf.entry, `${formatDateIST(session.entryAt)} ${formatTimeIST(session.entryAt)}`);
    if (type === "exit") {
      printRow(dict.pdf.exit, session.exitAt ? `${formatDateIST(session.exitAt)} ${formatTimeIST(session.exitAt)}` : dict.common.active);
      printRow(dict.pdf.duration, humanizeDuration(durationMin));
      if (session.exitOperatorName || session.entryOperatorName) {
        printRow(dict.pdf.operator, session.exitOperatorName || session.entryOperatorName || dict.common.staff);
      }
      
      y += 2;
      doc.setLineDashPattern([1, 1], 0);
      doc.line(5, y, pageWidth - 5, y);
      doc.setLineDashPattern([], 0);
      y += 6;

      
      const hoursBillable = Math.max(1, Math.ceil(durationMin / 60));
      printRow(dict.pdf.parkingRate, `${hoursBillable} ${dict.pdf.hours}`);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(dict.pdf.totalCharges, 5, y);
      doc.text(`Rs. ${amountRs}`, pageWidth - 5, y, { align: "right" });
      y += 8;
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`${dict.pdf.inWords} ${numberToWordsINR(amountRs)}`, 5, y);
      y += 5;
      doc.text(`${dict.pdf.paymentMode} ${session.paymentMethod || "UPI"}`, 5, y);
      doc.text(`${dict.common.status}: ${session.paymentStatus || "PAID"}`, pageWidth - 5, y, { align: "right" });
      
      y += 6;
    } else {
      // Entry Ticket Specific Text
      y += 4;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(dict.pdf.keepTicketSafe, pageWidth / 2, y, { align: "center" });
      y += 4;
      doc.text(dict.pdf.chargesAtExit, pageWidth / 2, y, { align: "center" });
      y += 4;
      doc.text(dict.pdf.calculatedAtExit, pageWidth / 2, y, { align: "center" });
      y += 8;
    }
    doc.setFontSize(7);
    doc.text(dict.pdf.thankYou, pageWidth / 2, y, { align: "center" });
    
    const filename = `parking-bill-${session.vehicleNumber.toUpperCase()}-${session.id.slice(-6)}.pdf`;
    if (returnFileOnly === "base64") {
      return doc.output("datauristring").split(',')[1];
    } else if (returnFileOnly) {
      const blob = doc.output("blob");
      return new File([blob], filename, { type: "application/pdf" });
    } else {
      doc.save(filename);
      return;
    }
  }

  // ─── 1. HEADER BANNER (Expanded height) ─────────────────
  doc.setFillColor(15, 23, 42); // #0F172A
  doc.rect(0, 0, pageWidth, 44, "F");

  // Accent Sub-bar
  doc.setFillColor(37, 99, 235); // #2563EB
  doc.rect(0, 44, pageWidth, 3, "F");

  // Brand Crest Box
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(14, 10, 24, 24, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("SWP", 26, 25.5, { align: "center" });

  // Title & Address
  const brandName = session.site?.brand_name || session.site?.name || "SANT WAMANBHAU";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(`${brandName.toUpperCase()} ${dict.pdf.parking.toUpperCase()}`, 44, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const addressLine = session.site?.address ? `${session.site.address} • ${session.site.city}` : "The East Palace • Ahilyanagar, Maharashtra - 414001";
  doc.text(addressLine, 44, 23);
  doc.text(`UPI VPA: ${UPI_CONFIG.vpa}`, 44, 29);
  const contactNo = session.site?.contact_number || UPI_CONFIG.mobile;
  doc.text(`${dict.pdf.helpline} ${contactNo}`, 44, 35);

  // Receipt Badge Box
  const recNo = session.receiptNumber || `SWP-${session.id.slice(-6).toUpperCase()}`;
  doc.setFillColor(30, 41, 59);
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(pageWidth - 70, 9, 56, 26, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(59, 130, 246);
  doc.text(dict.pdf.taxInvoice, pageWidth - 42, 17, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`#${recNo}`, pageWidth - 42, 24, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(dict.pdf.originalDocument, pageWidth - 42, 30, { align: "center" });

  // ─── 2. SUB-BAR METADATA ──────────────────────────────────
  let y = 53;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, y, pageWidth - 28, 10, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`${dict.pdf.issuedDate} ${formatDateIST(session.exitAt || session.entryAt)} ${formatTimeIST(session.exitAt || session.entryAt)}`, 18, y + 6.5);
  doc.text(`${dict.common.status}: ${(session.paymentStatus || "PAID").toUpperCase()}`, pageWidth / 2, y + 6.5, { align: "center" });
  doc.text(`${dict.pdf.paymentMode} ${(session.paymentMethod || "CASH").toUpperCase()}`, pageWidth - 18, y + 6.5, { align: "right" });

  y += 16;

  // ─── 3. DETAILS CARDS ────────────────────────────────────
  const cardWidth = 88;
  const cardHeight = 48;

  // Left Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, y, cardWidth, cardHeight, 3.5, 3.5, "FD");

  doc.setFillColor(226, 232, 240);
  doc.rect(14, y, cardWidth, 9.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(dict.pdf.vehicleDriverDetails, 18, y + 6.5);

  const vConfig = VEHICLE_TYPE_CONFIG[session.vehicleType as keyof typeof VEHICLE_TYPE_CONFIG];

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.vehicleNumber, 18, y + 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(session.vehicleNumber.toUpperCase(), 52, y + 17);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.categoryLabel, 18, y + 25);
  doc.setFont("helvetica", "semibold");
  doc.setTextColor(15, 23, 42);
  doc.text(vConfig?.label || session.vehicleType, 52, y + 25);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.driverPhoneLabel, 18, y + 33);
  doc.setFont("helvetica", "medium");
  doc.setTextColor(15, 23, 42);
  const driverDisplay = session.driverName 
    ? (session.driverNumber ? `${session.driverName} (${session.driverNumber})` : session.driverName)
    : (session.driverNumber || "N/A");
  doc.text(driverDisplay, 52, y + 33);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.remarksNotes, 18, y + 41);
  doc.setFont("helvetica", "medium");
  doc.setTextColor(15, 23, 42);
  doc.text(session.notes ? (session.notes.length > 22 ? session.notes.slice(0, 20) + "..." : session.notes) : dict.common.none, 52, y + 41);

  // Right Card
  const rightX = 108;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightX, y, cardWidth, cardHeight, 3.5, 3.5, "FD");

  doc.setFillColor(226, 232, 240);
  doc.rect(rightX, y, cardWidth, 9.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(dict.pdf.sessionTimingStaff, rightX + 4, y + 6.5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.entryTime, rightX + 4, y + 17);
  doc.setFont("helvetica", "medium");
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatDateIST(session.entryAt)} ${formatTimeIST(session.entryAt)}`, rightX + 38, y + 17);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.exitTime, rightX + 4, y + 25);
  doc.setFont("helvetica", "medium");
  doc.setTextColor(15, 23, 42);
  doc.text(session.exitAt ? `${formatDateIST(session.exitAt)} ${formatTimeIST(session.exitAt)}` : dict.common.active, rightX + 38, y + 25);

  const durationMin = session.durationMinutes || Math.floor((Date.now() - new Date(session.entryAt).getTime()) / 60000);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.totalDuration, rightX + 4, y + 33);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(humanizeDuration(durationMin), rightX + 38, y + 33);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.staffGate, rightX + 4, y + 41);
  doc.setFont("helvetica", "medium");
  doc.setTextColor(15, 23, 42);
  doc.text(session.exitOperatorName || session.entryOperatorName || dict.common.staff, rightX + 38, y + 41);

  y += cardHeight + 8;

  // ─── 4. TABLE ─────────────────────────────────────────────
  const amountRs = (session.grossAmount || 0) / 100;
  const hoursBillable = Math.max(1, Math.ceil(durationMin / 60));
  const amountWords = numberToWordsINR(amountRs);
  const formattedAmount = `Rs. ${amountRs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const tableHead = [[dict.pdf.srNo, dict.pdf.itemDescription, dict.pdf.billingUnit, dict.pdf.paymentMethodCol, dict.pdf.statusCol, dict.pdf.amountInr]];
  const tableBody = [
    [
      "1",
      `${dict.pdf.parkingCharges} (${vConfig?.label || session.vehicleType})`,
      `${hoursBillable} ${dict.pdf.hours}`,
      session.paymentMethod || "UPI / CASH",
      session.paymentStatus || "PAID",
      formattedAmount,
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59],
      cellPadding: 4.5,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 68 },
      2: { cellWidth: 30 },
      3: { cellWidth: 26 },
      4: { cellWidth: 22, fontStyle: "bold" },
      5: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  const tableFinalY = (doc as any).lastAutoTable.finalY || y + 30;
  y = tableFinalY + 8;

  // ─── 5. PAYMENT SUMMARY & QR CODE BOX ─────────────────────
  const summaryHeight = 52;
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14, y, pageWidth - 28, summaryHeight, 4, 4, "FD");

  const upiPayload = `upi://pay?pa=${UPI_CONFIG.vpa}&pn=${encodeURIComponent(UPI_CONFIG.payeeName)}&am=${amountRs.toFixed(2)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiPayload)}`;
  const qrBase64 = await getBase64ImageFromUrl(qrUrl);

  if (qrBase64) {
    try {
      doc.addImage(qrBase64, "PNG", 18, y + 5, 42, 42);
    } catch (e) {}
  }

  const textLeftX = qrBase64 ? 64 : 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(dict.pdf.amountPaid, textLeftX, y + 12);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.includesFees, textLeftX, y + 19);
  doc.text(`UPI VPA: ${UPI_CONFIG.vpa}`, textLeftX, y + 26);

  // Amount in Words
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(dict.pdf.amountInWords, textLeftX, y + 36);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(amountWords, textLeftX + 28, y + 36);

  // Numerical Amount (Large)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(37, 99, 235);
  doc.text(formattedAmount, pageWidth - 20, y + 20, { align: "right" });

  // Vector Green Payment Verified Badge
  doc.setFillColor(209, 250, 229); // Emerald 100 #d1fae5
  doc.setDrawColor(110, 231, 183); // Emerald 300 #6ee7b7
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth - 60, y + 24, 40, 6.5, 1.5, 1.5, "FD");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(4, 120, 87); // Emerald 700 #047857
  doc.text(dict.pdf.paymentVerified, pageWidth - 40, y + 28.3, { align: "center" });

  y += summaryHeight + 10;

  // ─── 6. TERMS & SIGNATURE ────────────────────────────────
  const sigBoxWidth = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(dict.pdf.termsTitle, 14, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(dict.pdf.term1, 14, y + 5);
  doc.text(dict.pdf.term2, 14, y + 9.5);
  doc.text(dict.pdf.term3, 14, y + 14);

  // Signatory Box
  const sigX = pageWidth - 14 - sigBoxWidth;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(sigX, y - 2, sigBoxWidth, 24, 3, 3, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`${brandName} Parking`, sigX + sigBoxWidth / 2, y + 5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(dict.pdf.computerGenerated, sigX + sigBoxWidth / 2, y + 12, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text(dict.pdf.authenticated, sigX + sigBoxWidth / 2, y + 18, { align: "center" });

  // ─── 7. FOOTER ──────────────────────────────────────────
  const footerY = pageHeight - 16;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`${dict.pdf.thankYouParking} ${brandName} ${dict.pdf.parking}!`, pageWidth / 2, footerY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${dict.pdf.generatedOn} ${formatDateIST(new Date().toISOString())} ${formatTimeIST(new Date().toISOString())} | ${dict.pdf.validDocument}`, 14, footerY + 5);
  doc.text(dict.pdf.pageInfo, pageWidth - 14, footerY + 5, { align: "right" });

  const filename = `parking-bill-${session.vehicleNumber.toUpperCase()}-${session.id.slice(-6)}.pdf`;
  if (returnFileOnly === "base64") {
    return doc.output("datauristring").split(',')[1];
  } else if (returnFileOnly) {
    const blob = doc.output("blob");
    return new File([blob], filename, { type: "application/pdf" });
  } else {
    doc.save(filename);
  }
}
