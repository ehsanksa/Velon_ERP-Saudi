import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { SalesInvoicePaymentMethod, SalesInvoiceStatus } from '@velon/database';

export type InvoicePdfInput = {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  status: SalesInvoiceStatus;
  paymentMethod?: SalesInvoicePaymentMethod | null;
  referenceNumber?: string | null;
  salespersonName?: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  shippingCharges: number;
  roundingAdjustment: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string | null;
  footerNotes?: string | null;
  company: {
    name: string;
    legalName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    website?: string | null;
    taxId?: string | null;
    commercialRegistrationNumber?: string | null;
    logoDataUrl?: string | null;
  };
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxId?: string | null;
    notes?: string | null;
  };
  items: Array<{
    itemName: string;
    sku?: string | null;
    quantity: number;
    uom?: string | null;
    unitPrice: number;
    discount: number;
    taxRate: number;
    lineTotal: number;
  }>;
};

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/[\w+.-]+;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

@Injectable()
export class InvoicePdfService {
  async generate(input: InvoicePdfInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100;
      const logoBuffer = input.company.logoDataUrl
        ? dataUrlToBuffer(input.company.logoDataUrl)
        : null;

      const drawWatermark = () => {
        if (!logoBuffer) return;
        const centerX = doc.page.width / 2;
        const centerY = doc.page.height / 2;
        doc.save();
        doc.opacity(0.06);
        const size = 220;
        doc.image(logoBuffer, centerX - size / 2, centerY - size / 2, {
          fit: [size, size],
          align: 'center',
          valign: 'center',
        });
        doc.opacity(1);
        doc.restore();
      };

      drawWatermark();

      let y = 50;
      if (logoBuffer) {
        doc.image(logoBuffer, 50, y, { fit: [72, 72] });
      }

      const headerX = logoBuffer ? 140 : 50;
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(input.company.legalName ?? input.company.name, headerX, y);
      doc.fontSize(10).font('Helvetica').fillColor('#444444');
      if (input.company.address) doc.text(input.company.address, headerX);
      const contactBits = [input.company.phone, input.company.email].filter(Boolean).join(' · ');
      if (contactBits) doc.text(contactBits, headerX);
      if (input.company.taxId) doc.text(`VAT: ${input.company.taxId}`, headerX);
      if (input.company.commercialRegistrationNumber) {
        doc.text(`CR: ${input.company.commercialRegistrationNumber}`, headerX);
      }
      doc.fillColor('#000000');

      doc.fontSize(22).font('Helvetica-Bold').text('INVOICE', 50, y, {
        width: pageWidth,
        align: 'right',
      });
      doc.fontSize(11).font('Helvetica');
      doc.text(input.invoiceNumber, 50, y + 28, { width: pageWidth, align: 'right' });
      doc.text(`Status: ${input.status.replace(/_/g, ' ')}`, 50, doc.y, {
        width: pageWidth,
        align: 'right',
      });
      doc.moveDown(2);

      const leftY = doc.y;
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To', 50, leftY);
      doc.fontSize(10).font('Helvetica');
      doc.text(input.customer.name);
      if (input.customer.email) doc.text(input.customer.email);
      if (input.customer.phone) doc.text(input.customer.phone);
      if (input.customer.address) doc.text(input.customer.address);
      if (input.customer.taxId) doc.text(`Customer VAT: ${input.customer.taxId}`);

      const rightColX = 320;
      doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details', rightColX, leftY);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Issue date: ${input.issueDate}`, rightColX);
      if (input.dueDate) doc.text(`Due date: ${input.dueDate}`, rightColX);
      if (input.paymentMethod)
        doc.text(`Payment: ${input.paymentMethod.replace(/_/g, ' ')}`, rightColX);
      if (input.salespersonName) doc.text(`Salesperson: ${input.salespersonName}`, rightColX);
      if (input.referenceNumber) doc.text(`Reference: ${input.referenceNumber}`, rightColX);
      doc.moveDown(2);

      const tableTop = doc.y + 8;
      doc.fontSize(9).font('Helvetica-Bold');
      const cols = [50, 210, 260, 300, 340, 380, 460];
      doc.text('Item', cols[0], tableTop);
      doc.text('Qty', cols[1], tableTop);
      doc.text('Unit', cols[2], tableTop);
      doc.text('Price', cols[3], tableTop);
      doc.text('Disc.', cols[4], tableTop);
      doc.text('Tax%', cols[5], tableTop);
      doc.text('Total', cols[6], tableTop);
      doc
        .moveTo(50, tableTop + 14)
        .lineTo(545, tableTop + 14)
        .stroke('#dddddd');
      doc.font('Helvetica');

      let rowY = tableTop + 22;
      for (const item of input.items) {
        drawWatermark();
        doc.text(item.itemName.slice(0, 34), cols[0], rowY, { width: 150 });
        doc.text(String(item.quantity), cols[1], rowY);
        doc.text(item.uom ?? '—', cols[2], rowY);
        doc.text(item.unitPrice.toFixed(2), cols[3], rowY);
        doc.text(item.discount.toFixed(2), cols[4], rowY);
        doc.text(`${item.taxRate}%`, cols[5], rowY);
        doc.text(item.lineTotal.toFixed(2), cols[6], rowY);
        rowY += 18;
        if (rowY > doc.page.height - 120) {
          doc.addPage();
          drawWatermark();
          rowY = 60;
        }
      }

      doc.moveDown(2);
      const totalsX = 360;
      let totalsY = Math.max(rowY + 12, doc.y);
      doc.font('Helvetica');
      doc.text(`Subtotal: ${formatMoney(input.subtotal, input.currency)}`, totalsX, totalsY, {
        width: 185,
        align: 'right',
      });
      totalsY += 14;
      doc.text(`Discount: ${formatMoney(input.discount, input.currency)}`, totalsX, totalsY, {
        width: 185,
        align: 'right',
      });
      totalsY += 14;
      doc.text(`Tax: ${formatMoney(input.taxAmount, input.currency)}`, totalsX, totalsY, {
        width: 185,
        align: 'right',
      });
      if (input.shippingCharges > 0) {
        totalsY += 14;
        doc.text(
          `Shipping: ${formatMoney(input.shippingCharges, input.currency)}`,
          totalsX,
          totalsY,
          {
            width: 185,
            align: 'right',
          },
        );
      }
      if (input.roundingAdjustment !== 0) {
        totalsY += 14;
        doc.text(
          `Rounding: ${formatMoney(input.roundingAdjustment, input.currency)}`,
          totalsX,
          totalsY,
          { width: 185, align: 'right' },
        );
      }
      totalsY += 16;
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Total: ${formatMoney(input.total, input.currency)}`, totalsX, totalsY, {
        width: 185,
        align: 'right',
      });
      totalsY += 16;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Paid: ${formatMoney(input.amountPaid, input.currency)}`, totalsX, totalsY, {
        width: 185,
        align: 'right',
      });
      totalsY += 14;
      doc.text(`Balance due: ${formatMoney(input.balanceDue, input.currency)}`, totalsX, totalsY, {
        width: 185,
        align: 'right',
      });

      if (input.notes) {
        doc.moveDown(2);
        doc.fontSize(11).font('Helvetica-Bold').text('Notes');
        doc.fontSize(10).font('Helvetica').text(input.notes, { width: pageWidth });
      }

      const footer = input.footerNotes ?? `Thank you for your business.`;
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(footer, 50, doc.page.height - 40, {
          width: pageWidth,
          align: 'center',
        });

      doc.end();
    });
  }
}
