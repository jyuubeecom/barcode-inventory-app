"use strict";

(function (root) {
  const spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const packageRelationships = "http://schemas.openxmlformats.org/package/2006/relationships";
  const contentTypes = "http://schemas.openxmlformats.org/package/2006/content-types";

  function xmlText(value) {
    return value.replace(/_x[0-9a-f]{4}_/gi, match => "_x005F_" + match.slice(1))
      .replace(/[\u0000-\u0008\u000B\u000C\u000D\u000E-\u001F\uFFFE\uFFFF]/g,
        char => "_x" + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") + "_")
      .replace(/[&<>]/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;"})[char]);
  }

  async function create(rows, options = {}) {
    const plannedRows = new Set(options.plannedRows || []);
    const zip = new root.JSZip();
    zip.file("[Content_Types].xml", `<Types xmlns="${contentTypes}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
    zip.file("_rels/.rels", `<Relationships xmlns="${packageRelationships}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file("xl/workbook.xml", `<workbook xmlns="${spreadsheet}" xmlns:r="${office}"><sheets><sheet name="作業一覧" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<Relationships xmlns="${packageRelationships}"><Relationship Id="rId1" Type="${office}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${office}/styles" Target="styles.xml"/></Relationships>`);

    zip.file("xl/styles.xml", `<styleSheet xmlns="${spreadsheet}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1B5"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    const widths = [15, 12, 17, 28, 15, 15, 20, 20];
    const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
    const sheetRows = rows.map((row, index) => {
      const rowNumber = index + 1;
      const cells = row.map((value, column) => {
        const cellStyle = plannedRows.has(index) ? ' s="1"' : "";
        const address = String.fromCharCode(65 + column) + rowNumber;
        return typeof value === "number"
          ? `<c r="${address}"${cellStyle}><v>${value}</v></c>`
          : `<c r="${address}"${cellStyle} t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
      }).join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    }).join("");
    zip.file("xl/worksheets/sheet1.xml", `<worksheet xmlns="${spreadsheet}"><cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`);
    return zip.generateAsync({type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }

  root.inventoryAmazonPickXlsx = Object.freeze({create});
})(typeof window === "undefined" ? globalThis : window);
