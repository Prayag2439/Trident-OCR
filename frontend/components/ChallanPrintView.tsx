"use client";

import { useRef } from "react";
import { X, Printer } from "lucide-react";
import { ChallanData } from "@/types/ocr";

interface ChallanPrintViewProps {
  data: ChallanData;
  onClose: () => void;
}

export function ChallanPrintView({ data, onClose }: ChallanPrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const computedWeight = data.items
    .reduce((sum, item) => sum + parseFloat(item.weightMT || "0"), 0)
    .toFixed(3);

  const displayWeight = data.totalWeightOverride && parseFloat(data.totalWeightOverride) > 0
    ? data.totalWeightOverride
    : computedWeight;

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Challan ${data.challanNo}</title>
  <meta charset="utf-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:11px;color:#000;background:#fff}
    .challan-outer{max-width:800px;margin:0 auto;border:2px solid #000}
    .co-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #000}
    .co-logo-block{display:flex;align-items:center;gap:10px}
    .co-logo-box{width:50px;height:50px;border:2px solid #1a237e;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#1a237e;flex-shrink:0}
    .co-logo-text{font-size:16px;font-weight:900;color:#fff;letter-spacing:2px}
    .co-name{font-size:15px;font-weight:900;color:#1a237e;letter-spacing:1px}
    .co-sub{font-size:9px;color:#555;margin-top:1px}
    .co-gstin{font-size:9px;font-weight:bold;color:#333;margin-top:2px}
    .co-contact{text-align:right;font-size:9px;color:#555;line-height:1.5}
    .ch-banner{text-align:center;font-size:13px;font-weight:900;letter-spacing:3px;border-top:1px solid #000;border-bottom:1px solid #000;padding:5px 0;background:#f8f8f8}
    .meta-row{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #000}
    .meta-cell{padding:6px 10px;border-right:1px solid #000}
    .meta-cell:last-child{border-right:none}
    .meta-label{font-size:8px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:.05em}
    .meta-val{font-size:12px;font-weight:700}
    .meta-row2{display:grid;grid-template-columns:1fr 2fr;border-bottom:1px solid #000}
    .cons-row{padding:8px 10px;border-bottom:1px solid #000}
    .cons-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:3px}
    .cons-item{font-size:10px}
    .cons-label{font-size:8px;font-weight:bold;color:#666;text-transform:uppercase}
    .cons-val{font-weight:bold;color:#000}
    .sec-label{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#555;padding:4px 10px;background:#f4f4f4;border-bottom:1px solid #ddd}
    table{width:100%;border-collapse:collapse}
    th{background:#f0f0f0;border:1px solid #ccc;padding:5px 7px;font-size:9px;font-weight:bold;text-align:left;text-transform:uppercase;letter-spacing:.04em}
    td{border:1px solid #ddd;padding:4px 7px;font-size:10px;vertical-align:middle}
    tr:nth-child(even) td{background:#fafafa}
    .tot-row{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:2px solid #000;border-bottom:1px solid #000}
    .tot-cell{padding:7px 10px;border-right:1px solid #000}
    .tot-cell:last-child{border-right:none}
    .tot-label{font-size:8px;font-weight:bold;color:#666;text-transform:uppercase}
    .tot-val{font-size:18px;font-weight:900;color:#1a237e}
    .tot-val-sm{font-size:13px;font-weight:bold}
    .remarks-box{padding:7px 10px;border-bottom:1px solid #000}
    .sign-row{display:grid;grid-template-columns:1fr 1fr}
    .sign-cell{padding:28px 14px 10px;border-right:1px solid #000;text-align:center;font-size:9px;color:#555}
    .sign-cell:last-child{border-right:none}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style>
</head>
<body>${printContent}</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4">

        {/* Modal Controls */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">
              Challan Preview — {data.challanNo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-[#1a237e] text-white hover:bg-[#283593] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Challan Print Preview */}
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          <div ref={printRef} className="challan-outer border-2 border-black text-[11px] font-sans text-black">

            {/* Company Header */}
            <div className="co-header flex items-center justify-between px-3 py-2.5 border-b border-black">
              <div className="co-logo-block flex items-center gap-2.5">
                {/* Logo image */}
                <img
                  src="/trident-logo.png"
                  alt="Trident Logo"
                  style={{ height: 46, width: "auto" }}
                  className="object-contain"
                />
                <div>
                  <div className="co-sub text-[9px] text-gray-500 mt-0.5">
                    Plot No - 112, Industrial Estate, Kalunga, Sambalpur, Odisha - 768212
                  </div>
                  <div className="co-sub text-[9px] text-gray-500">
                    (An ISO 9001-2008 Certified Company)
                  </div>
                  <div className="co-gstin text-[9px] font-bold text-gray-700 mt-0.5">
                    GSTIN: {data.fromGstin || "21AACCT1555G1ZR"} &nbsp;|&nbsp; PAN: AACCT1555G
                  </div>
                </div>
              </div>
              <div className="co-contact text-right text-[9px] text-gray-500 leading-relaxed">
                <div>Phone: 0663-XXXXXXXX</div>
                <div>Email: info@tridentfab.com</div>
                <div>Web: www.tridentfab.com</div>
              </div>
            </div>

            {/* Challan Banner */}
            <div className="ch-banner text-center text-[13px] font-black tracking-[3px] border-t border-b border-black py-1.5 bg-gray-50">
              CHALLAN &amp; DESPATCH MEMO
            </div>

            {/* Meta Grid Row 1 */}
            <div className="meta-row grid grid-cols-3 border-b border-black">
              <div className="meta-cell border-r border-black px-2.5 py-1.5">
                <div className="meta-label text-[8px] font-bold text-gray-500 uppercase tracking-wider">Challan No.</div>
                <div className="meta-val text-sm font-black">{data.challanNo || "—"}</div>
              </div>
              <div className="meta-cell border-r border-black px-2.5 py-1.5">
                <div className="meta-label text-[8px] font-bold text-gray-500 uppercase tracking-wider">Date</div>
                <div className="meta-val text-sm font-bold">{data.date || "—"}</div>
              </div>
              <div className="meta-cell px-2.5 py-1.5">
                <div className="meta-label text-[8px] font-bold text-gray-500 uppercase tracking-wider">Your Order No.</div>
                <div className="meta-val text-sm font-bold">{data.yourOrderNo || "—"}</div>
              </div>
            </div>

            {/* Meta Grid Row 2 */}
            <div className="meta-row grid grid-cols-2 border-b border-black">
              <div className="meta-cell border-r border-black px-2.5 py-1.5">
                <div className="meta-label text-[8px] font-bold text-gray-500 uppercase tracking-wider">Vehicle No.</div>
                <div className="meta-val text-sm font-bold">{data.vehicleNo || "—"}</div>
              </div>
              <div className="meta-cell px-2.5 py-1.5">
                <div className="meta-label text-[8px] font-bold text-gray-500 uppercase tracking-wider">E-Way Bill No.</div>
                <div className="meta-val text-sm font-bold">{data.ewayBillNo || "—"}</div>
              </div>
            </div>

            {/* Consignee */}
            <div className="cons-row border-b border-black px-2.5 py-2">
              <div className="sec-label text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">
                Consignee (To)
              </div>
              <div className="cons-grid grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <div className="cons-label text-[8px] font-bold text-gray-500 uppercase">Party Name</div>
                  <div className="cons-val font-bold text-black">{data.partyName || "—"}</div>
                </div>
                <div>
                  <div className="cons-label text-[8px] font-bold text-gray-500 uppercase">GSTIN</div>
                  <div className="cons-val font-bold text-black">{data.gstin || "—"}</div>
                </div>
                <div>
                  <div className="cons-label text-[8px] font-bold text-gray-500 uppercase">Address</div>
                  <div className="cons-val font-bold text-black">{data.address || "—"}</div>
                </div>
              </div>
            </div>

            {/* Description of Goods */}
            <div className="sec-label text-[8px] font-black text-gray-500 uppercase tracking-widest px-2.5 py-1.5 bg-gray-50 border-b border-black">
              Description of Goods
            </div>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1.5 text-left font-bold text-[9px] uppercase">Sl.</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-left font-bold text-[9px] uppercase">Item No. (HSN)</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-left font-bold text-[9px] uppercase">Description</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-center font-bold text-[9px] uppercase">QTY</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-center font-bold text-[9px] uppercase">UNIT</th>
                  <th className="border border-gray-300 px-2 py-1.5 text-right font-bold text-[9px] uppercase">Weight (MT)</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-500">{i + 1}</td>
                    <td className="border border-gray-300 px-2 py-1 font-mono font-bold text-[#1a237e]">{item.itemNo}</td>
                    <td className="border border-gray-300 px-2 py-1">{item.description}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-bold">{item.qty}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{item.unit}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-bold font-mono">{item.weightMT}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="tot-row grid grid-cols-3 border-t-2 border-b border-black">
              <div className="tot-cell border-r border-black px-2.5 py-2 bg-gray-50">
                <div className="tot-label text-[8px] font-bold text-gray-500 uppercase">Total Weight</div>
                <div className="tot-val text-xl font-black text-[#1a237e]">{displayWeight} MT</div>
              </div>
              <div className="tot-cell border-r border-black px-2.5 py-2">
                <div className="tot-label text-[8px] font-bold text-gray-500 uppercase">Computed Weight</div>
                <div className="tot-val-sm text-sm font-bold">{computedWeight} MT</div>
              </div>
              <div className="tot-cell px-2.5 py-2">
                <div className="tot-label text-[8px] font-bold text-gray-500 uppercase">Total Value Incl. Tax (₹)</div>
                <div className="tot-val-sm text-sm font-bold">₹ {data.totalValueInclTax || "0"}</div>
              </div>
            </div>

            {/* Remarks */}
            {data.remarks && (
              <div className="remarks-box border-b border-black px-2.5 py-2">
                <div className="sec-label text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Remarks / Terms</div>
                <div className="text-[10px] italic text-gray-700">{data.remarks}</div>
              </div>
            )}

            {/* Signatures */}
            <div className="sign-row grid grid-cols-2">
              <div className="sign-cell border-r border-black px-4 py-7 text-center text-[9px] text-gray-500">
                Receiver's Signature &amp; Stamp
              </div>
              <div className="sign-cell px-4 py-7 text-center text-[9px] text-gray-500">
                For Trident Fabricators Pvt. Ltd.
                <div className="mt-3 text-[9px]">Authorised Signatory</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
