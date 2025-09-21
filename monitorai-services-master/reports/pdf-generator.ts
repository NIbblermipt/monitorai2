import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ReportData, ReportScreenDetail, ReportRepairmanDetail } from "./types";
import log from "encore.dev/log";
import { appMeta } from "encore.dev";

export async function generatePDF(data: ReportData): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Load custom font (PTSerif) with fallback to Helvetica
    let customFont;
    try {
      const fontResponse = await fetch(
        `${appMeta().apiBaseUrl}/static/PTSerif.ttf`,
      );
      if (!fontResponse.ok) {
        log.warn(
          "Failed to load custom font PTSerif.ttf, falling back to Helvetica",
          { status: fontResponse.status, statusText: fontResponse.statusText },
        );
        customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      } else {
        customFont = await pdfDoc.embedFont(await fontResponse.arrayBuffer());
      }
    } catch (fontError) {
      log.error("Error embedding custom font, falling back to Helvetica", {
        error:
          fontError instanceof Error ? fontError.message : String(fontError),
      });
      customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Ensure customFont is not null or undefined, if it still is, use Helvetica
    // This provides a final safeguard against uninitialized font.
    if (!customFont) {
      log.error(
        "Custom font could not be loaded or embedded, using Helvetica as a last resort.",
      );
      customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // Unify font usage: all text will use the selected customFont (or its Helvetica fallback)
    const helveticaFont = customFont;
    const helveticaBoldFont = customFont; // Using customFont for "bold" effect as PTSerif is regular. For true bold, a bold variant of PTSerif would be needed.

    let page = pdfDoc.addPage([600, 800]);
    let { height, width } = page.getSize();
    let yOffset = height - 60; // Current Y position for drawing

    // Helper to check if new page is needed and add header for tables
    const checkAndAddPage = (
      currentY: number,
      requiredRows: number,
      rowHeight: number,
    ) => {
      const requiredSpace = requiredRows * rowHeight + 40; // Space needed for rows + some padding
      if (currentY - requiredSpace < 50) {
        // 50 is a bottom margin
        page = pdfDoc.addPage([600, 800]);
        return height - 60; // Reset yOffset for new page
      }
      return currentY;
    };

    log.info("Starting PDF report generation", { company: data.companyName });

    // Title
    const title = `Ежемесячный отчет для ${data.companyName}`;
    const maxWidth = width - 100; // 50px padding on each side
    const titleFontSize = 20;

    // Check text width and reduce font size if necessary
    const textWidth = customFont.widthOfTextAtSize(title, titleFontSize);
    const actualTitleFontSize =
      textWidth > maxWidth
        ? titleFontSize * (maxWidth / textWidth)
        : titleFontSize;

    page.drawText(title, {
      x: 50,
      y: yOffset,
      size: actualTitleFontSize,
      font: customFont,
      color: rgb(0.2, 0.4, 0.6),
    });
    yOffset -= actualTitleFontSize + 10; // Move down after title

    // Metadata block with grey background
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    page.drawRectangle({
      x: 40,
      y: yOffset - 55, // Adjust Y to position the rectangle correctly
      width: width - 80,
      height: 60,
      color: rgb(0.95, 0.95, 0.95),
      borderWidth: 0,
    });

    page.drawLine({
      start: { x: 50, y: yOffset - 5 },
      end: { x: width - 50, y: yOffset - 5 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    const periodText = `Отчетный период: ${lastMonth.toLocaleString("ru-RU", { month: "long" })} ${lastMonth.getFullYear()}`;
    page.drawText(periodText, {
      x: 50,
      y: yOffset - 20,
      size: 12,
      font: customFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    const creationTime = `Отчет создан: ${now.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    page.drawText(creationTime, {
      x: 50,
      y: yOffset - 40,
      size: 12,
      font: customFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    yOffset -= 65; // Move down after metadata block

    log.info("Title and report period added", {
      company: data.companyName,
      period: periodText,
    });

    // Statistics with separators
    const statFontSize = 14;
    const statLineHeight = 30;

    const addStat = (label: string, value: string | number) => {
      // Check if new page is needed for next stat
      if (yOffset < 50 + statLineHeight) {
        page = pdfDoc.addPage([600, 800]);
        yOffset = height - 60;
      }

      page.drawText(`${label}:`, {
        x: 50,
        y: yOffset,
        size: statFontSize,
        font: customFont,
        color: rgb(0.2, 0.4, 0.6),
      });
      page.drawText(`${value}`, {
        x: 250,
        y: yOffset,
        size: statFontSize,
        font: customFont,
        color: rgb(0, 0, 0),
      });
      page.drawLine({
        start: { x: 50, y: yOffset - 10 },
        end: { x: width - 50, y: yOffset - 10 },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      });
      yOffset -= statLineHeight;
    };

    const logger = log.with({
      company: data.companyName,
      reportType: "monthly",
    });

    yOffset -= 20; // Some space before stats
    addStat("Всего экранов", data.totalScreens);
    addStat("Аптайм", `${data.uptime.toFixed(2)}%`);
    addStat("Всего инцидентов", data.totalIncidents);
    addStat("Открытые инциденты", data.unresolvedIncidents);

    logger.info("Statistics added", {
      totalScreens: data.totalScreens,
      uptime: data.uptime,
      totalIncidents: data.totalIncidents,
      unresolvedIncidents: data.unresolvedIncidents,
    });

    if (data.avgResolutionTime) {
      addStat("Среднее время устранения", data.avgResolutionTime);
      logger.debug("Average resolution time added", {
        avgResolutionTime: data.avgResolutionTime,
      });
    }

    yOffset -= 40; // Space before tables

    // --- Table: Screen Details ---
    if (data.screenDetails && data.screenDetails.length > 0) {
      const tableX = 50;
      const tableWidth = width - 100;
      const rowHeight = 25;
      const headerFontSize = 10;
      const cellFontSize = 9;
      const colPadding = 5;

      const screenHeaders = [
        "№",
        "Идентификатор",
        "Аптайм",
        "Оператор",
        "Инцидентов",
        "Координаты",
      ];
      // Define column widths
      const screenColWidths = [
        tableWidth * 0.05, // №
        tableWidth * 0.2, // Идентификатор
        tableWidth * 0.1, // Аптайм
        tableWidth * 0.25, // Оператор
        tableWidth * 0.15, // Инцидентов
        tableWidth * 0.25, // Координаты
      ];

      yOffset = checkAndAddPage(yOffset, data.screenDetails.length, rowHeight);
      page.drawText("Список экранов", {
        x: tableX,
        y: yOffset,
        size: 16,
        font: customFont,
        color: rgb(0.2, 0.4, 0.6),
      });
      yOffset -= 20;

      // Draw header row
      let currentX = tableX;
      for (let i = 0; i < screenHeaders.length; i++) {
        page.drawText(screenHeaders[i], {
          x: currentX + colPadding,
          y: yOffset - rowHeight + 7,
          size: headerFontSize,
          font: customFont,
          color: rgb(0, 0, 0),
        });
        currentX += screenColWidths[i];
      }
      page.drawLine({
        start: { x: tableX, y: yOffset - rowHeight + 2 },
        end: { x: tableX + tableWidth, y: yOffset - rowHeight + 2 },
        thickness: 1,
        color: rgb(0.5, 0.5, 0.5),
      });
      yOffset -= rowHeight;

      // Draw data rows
      data.screenDetails.forEach((screen, index) => {
        yOffset = checkAndAddPage(yOffset, 1, rowHeight); // Check for each row
        if (yOffset === height - 60) {
          // If new page, redraw header
          let currentXHeader = tableX;
          page.drawText("Список экранов (продолжение)", {
            x: tableX,
            y: yOffset,
            size: 16,
            font: customFont,
            color: rgb(0.2, 0.4, 0.6),
          });
          yOffset -= 20;
          for (let i = 0; i < screenHeaders.length; i++) {
            page.drawText(screenHeaders[i], {
              x: currentXHeader + colPadding,
              y: yOffset - rowHeight + 7,
              size: headerFontSize,
              font: customFont,
              color: rgb(0, 0, 0),
            });
            currentXHeader += screenColWidths[i];
          }
          page.drawLine({
            start: { x: tableX, y: yOffset - rowHeight + 2 },
            end: { x: tableX + tableWidth, y: yOffset - rowHeight + 2 },
            thickness: 1,
            color: rgb(0.5, 0.5, 0.5),
          });
          yOffset -= rowHeight;
        }

        currentX = tableX;
        const rowData = [
          (index + 1).toString(),
          screen.installationCode,
          `${screen.uptime.toFixed(2)}%`,
          screen.telecomOperatorName,
          screen.incidentCount.toString(),
          screen.coordinates
            ? `${screen.coordinates[1].toFixed(4)}, ${screen.coordinates[0].toFixed(4)}`
            : "нет",
        ];

        for (let i = 0; i < rowData.length; i++) {
          page.drawText(rowData[i], {
            x: currentX + colPadding,
            y: yOffset - rowHeight + 7,
            size: cellFontSize,
            font: customFont,
            color: rgb(0, 0, 0),
          });
          currentX += screenColWidths[i];
        }
        page.drawLine({
          start: { x: tableX, y: yOffset - rowHeight + 2 },
          end: { x: tableX + tableWidth, y: yOffset - rowHeight + 2 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
        yOffset -= rowHeight;
      });
      yOffset -= 40; // Increased space after table for better separation
    }

    // --- Table: Repairman Details ---
    if (data.repairmanDetails && data.repairmanDetails.length > 0) {
      const tableX = 50;
      const tableWidth = width - 100;
      const rowHeight = 25;
      const headerFontSize = 10;
      const cellFontSize = 9;
      const colPadding = 5;

      const repairmanHeaders = [
        "ФИО",
        "Экранов",
        "Инцидентов",
        "Устранено",
        "Не устр.",
        "Время устр.",
        "Время реакц.",
      ];
      // Define column widths
      const repairmanColWidths = [
        tableWidth * 0.2, // ФИО
        tableWidth * 0.1, // Экранов
        tableWidth * 0.13, // Инцидентов
        tableWidth * 0.13, // Устранено
        tableWidth * 0.13, // Не устр.
        tableWidth * 0.16, // Ср. время устр.
        tableWidth * 0.15, // Ср. время прим.
      ];

      yOffset = checkAndAddPage(
        yOffset,
        data.repairmanDetails.length,
        rowHeight,
      );
      page.drawText("Список ремонтников, привязанных к экранам", {
        x: tableX,
        y: yOffset,
        size: 16,
        font: customFont,
        color: rgb(0.2, 0.4, 0.6),
      });
      yOffset -= 20;

      // Draw header row
      let currentX = tableX;
      for (let i = 0; i < repairmanHeaders.length; i++) {
        page.drawText(repairmanHeaders[i], {
          x: currentX + colPadding,
          y: yOffset - rowHeight + 7,
          size: headerFontSize,
          font: customFont,
          color: rgb(0, 0, 0),
        });
        currentX += repairmanColWidths[i];
      }
      page.drawLine({
        start: { x: tableX, y: yOffset - rowHeight + 2 },
        end: { x: tableX + tableWidth, y: yOffset - rowHeight + 2 },
        thickness: 1,
        color: rgb(0.5, 0.5, 0.5),
      });
      yOffset -= rowHeight;

      // Draw data rows
      data.repairmanDetails.forEach((repairman, index) => {
        yOffset = checkAndAddPage(yOffset, 1, rowHeight); // Check for each row
        if (yOffset === height - 60) {
          // If new page, redraw header
          let currentXHeader = tableX;
          page.drawText(
            "Список ремонтников, привязанных к экранам (продолжение)",
            {
              x: tableX,
              y: yOffset,
              size: 16,
              font: customFont,
              color: rgb(0.2, 0.4, 0.6),
            },
          );
          yOffset -= 20;
          for (let i = 0; i < repairmanHeaders.length; i++) {
            page.drawText(repairmanHeaders[i], {
              x: currentXHeader + colPadding,
              y: yOffset - rowHeight + 7,
              size: headerFontSize,
              font: customFont,
              color: rgb(0, 0, 0),
            });
            currentXHeader += repairmanColWidths[i];
          }
          page.drawLine({
            start: { x: tableX, y: yOffset - rowHeight + 2 },
            end: { x: tableX + tableWidth, y: yOffset - rowHeight + 2 },
            thickness: 1,
            color: rgb(0.5, 0.5, 0.5),
          });
          yOffset -= rowHeight;
        }

        currentX = tableX;
        const rowData = [
          repairman.fullName,
          repairman.screensAssignedCount.toString(),
          repairman.totalIncidentsCount.toString(),
          repairman.resolvedIncidentsCount.toString(),
          repairman.unresolvedIncidentsCount.toString(),
          repairman.avgResolutionTime || "нет",
          repairman.avgAcceptanceTime || "нет",
        ];

        for (let i = 0; i < rowData.length; i++) {
          page.drawText(rowData[i], {
            x: currentX + colPadding,
            y: yOffset - rowHeight + 7,
            size: cellFontSize,
            font: customFont,
            color: rgb(0, 0, 0),
          });
          currentX += repairmanColWidths[i];
        }
        page.drawLine({
          start: { x: tableX, y: yOffset - rowHeight + 2 },
          end: { x: tableX + tableWidth, y: yOffset - rowHeight + 2 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
        yOffset -= rowHeight;
      });
    }

    // Footer
    // page.drawText("С уважением, команда MonitorAI", {
    //   x: width - 200,
    //   y: 50,
    //   size: 12,
    //   font: customFont,
    //   color: rgb(0.5, 0.5, 0.5),
    // });

    const pdfBytes = await pdfDoc.save();
    logger.info("PDF report successfully generated", { size: pdfBytes.length });
    return pdfBytes;
  } catch (error) {
    log.error("PDF generation error", {
      company: data.companyName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
