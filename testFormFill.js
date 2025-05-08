// readAndCreatePDF.js - A script that reads a PDF template and creates a new filled version
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

/**
 * Reads a PDF template and creates a new filled PDF
 */
async function fillRPLForm() {
  try {
    console.log("Starting PDF fill using read and create approach...");

    // Define paths
    const projectRoot = path.resolve(__dirname);
    const templatePath = path.join(
      projectRoot,
      "RtoForms",
      "rplIntakeForm.pdf"
    );
    const outputDir = path.join(projectRoot, "test-output");
    const outputFilePath = path.join(outputDir, "filled_form_new.pdf");

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}`);
    }

    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      console.error(`Template file not found at: ${templatePath}`);
      return {
        success: false,
        error: "Template file not found",
      };
    }

    console.log(`Reading template from: ${templatePath}`);
    const templateBytes = fs.readFileSync(templatePath);

    // First, create a new PDF document
    const newPdfDoc = await PDFDocument.create();

    // Load the template PDF
    const templatePdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });

    // Get the page count
    const pageCount = templatePdfDoc.getPageCount();
    console.log(`Template PDF has ${pageCount} pages`);

    // Copy all pages from the template to the new document
    const copiedPages = await newPdfDoc.copyPages(
      templatePdfDoc,
      Array.from({ length: pageCount }, (_, i) => i)
    );

    // Add all copied pages to the new document
    copiedPages.forEach((page) => {
      newPdfDoc.addPage(page);
    });

    console.log(`Copied ${pageCount} pages to new document`);

    // Get the Helvetica font
    const helveticaFont = await newPdfDoc.embedFont(StandardFonts.Helvetica);

    // Function to add text to a page
    const addTextToPage = (pageIndex, text, x, y, fontSize = 12) => {
      if (!text) return;
      if (pageIndex < 0 || pageIndex >= pageCount) {
        console.warn(
          `Page index ${pageIndex} out of bounds (0-${pageCount - 1})`
        );
        return;
      }

      try {
        const page = newPdfDoc.getPage(pageIndex);
        page.drawText(String(text), {
          x,
          y,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(
          `Added text to page ${pageIndex}: "${text}" at (${x}, ${y})`
        );
      } catch (error) {
        console.error(`Error adding text to page ${pageIndex}:`, error);
      }
    };

    // Function to add a checkbox mark
    const addCheckMark = (pageIndex, x, y) => {
      if (pageIndex < 0 || pageIndex >= pageCount) {
        console.warn(
          `Page index ${pageIndex} out of bounds (0-${pageCount - 1})`
        );
        return;
      }

      try {
        const page = newPdfDoc.getPage(pageIndex);
        page.drawText("X", {
          x,
          y,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(`Added checkbox mark to page ${pageIndex} at (${x}, ${y})`);
      } catch (error) {
        console.error(`Error adding checkbox to page ${pageIndex}:`, error);
      }
    };

    // Function to draw multiline text
    const drawMultilineText = (
      pageIndex,
      text,
      x,
      y,
      maxWidth,
      fontSize = 10,
      lineHeight = 14
    ) => {
      if (!text) return;
      if (pageIndex < 0 || pageIndex >= pageCount) {
        console.warn(
          `Page index ${pageIndex} out of bounds (0-${pageCount - 1})`
        );
        return;
      }

      try {
        const page = newPdfDoc.getPage(pageIndex);
        const words = String(text).split(" ");
        let line = "";
        let currentY = y;

        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word;
          const width = helveticaFont.widthOfTextAtSize(testLine, fontSize);

          if (width > maxWidth && line !== "") {
            page.drawText(line, {
              x,
              y: currentY,
              size: fontSize,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
            line = word;
            currentY -= lineHeight;
          } else {
            line = testLine;
          }
        }

        if (line) {
          page.drawText(line, {
            x,
            y: currentY,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }

        console.log(
          `Added multiline text to page ${pageIndex} at starting position (${x}, ${y})`
        );
      } catch (error) {
        console.error(
          `Error adding multiline text to page ${pageIndex}:`,
          error
        );
      }
    };

    // Create dummy data for testing - simplified version
    const dummyData = {
      studentDeclaration: {
        name: "John Smith",
        date: "08/05/2025",
        signature: "John Smith",
      },
      courseQualification: "Certificate III in Waterproofing (CPC31411)",
      confirmationOfReassessment: {
        studentName: "John Smith",
        qualification: "Certificate III in Waterproofing",
        email: "john.smith@example.com",
        mobile: "0400 123 456",
        dob: "15/01/1985",
      },
    };

    // Define some test coordinates to try
    // Note: We're trying a range of positions to increase chances of hitting a field
    const testCoordinates = [
      // Page 0 (First page)
      { item: "Test Text - Page 1", page: 0, x: 100, y: 700 },
      { item: "Student Name", page: 0, x: 100, y: 600 },
      { item: dummyData.studentDeclaration.name, page: 0, x: 200, y: 600 },
      { item: "Course", page: 0, x: 100, y: 550 },
      { item: dummyData.courseQualification, page: 0, x: 200, y: 550 },
      { item: "Email", page: 0, x: 100, y: 500 },
      {
        item: dummyData.confirmationOfReassessment.email,
        page: 0,
        x: 200,
        y: 500,
      },

      // Page 1 (Second page)
      { item: "Test Text - Page 2", page: 1, x: 100, y: 700 },
      { item: "Student Name", page: 1, x: 100, y: 600 },
      { item: dummyData.studentDeclaration.name, page: 1, x: 200, y: 600 },

      // Page 2 (Third page)
      { item: "Test Text - Page 3", page: 2, x: 100, y: 700 },
      { item: "Student Name", page: 2, x: 100, y: 600 },
      { item: dummyData.studentDeclaration.name, page: 2, x: 200, y: 600 },
      { item: "Date", page: 2, x: 100, y: 550 },
      { item: dummyData.studentDeclaration.date, page: 2, x: 200, y: 550 },
      { item: "Signature", page: 2, x: 100, y: 500 },
      { item: dummyData.studentDeclaration.signature, page: 2, x: 200, y: 500 },

      // Add initials to all pages
      ...Array.from({ length: Math.min(pageCount, 5) }, (_, i) => ({
        item: "JS", // John Smith initials
        page: i,
        x: 50,
        y: 750,
      })),
    ];

    console.log("\nFilling form with test positions...");
    testCoordinates.forEach((coord) => {
      addTextToPage(coord.page, coord.item, coord.x, coord.y);
    });

    // Add a checkbox test to a few places
    for (let page = 0; page < Math.min(pageCount, 3); page++) {
      for (let y = 400; y >= 200; y -= 50) {
        addCheckMark(page, 80, y);
      }
    }

    // Try some multiline text
    const testText =
      "This is a test for multiline text that should wrap properly if the coordinates are correct. This text should appear in multiple lines.";
    for (let page = 0; page < Math.min(pageCount, 2); page++) {
      drawMultilineText(page, testText, 100, 300, 300);
    }

    // Add a visual indicator on each page that we've processed it
    for (let i = 0; i < pageCount; i++) {
      // Add a blue circle in bottom right corner to indicate the page was processed
      const page = newPdfDoc.getPage(i);
      const { width, height } = page.getSize();

      page.drawCircle({
        x: width - 50,
        y: 50,
        radius: 20,
        color: rgb(0, 0, 1),
      });

      page.drawText(`Processed: Page ${i + 1}`, {
        x: width - 150,
        y: 45,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
    }

    // Save the filled form
    console.log("\nSaving filled PDF...");
    const filledPdfBytes = await newPdfDoc.save();

    // Write the filled PDF to file
    fs.writeFileSync(outputFilePath, filledPdfBytes);
    console.log(`\nFilled PDF saved to: ${outputFilePath}`);
    console.log(`File size: ${fs.statSync(outputFilePath).size} bytes`);

    return {
      success: true,
      outputPath: outputFilePath,
    };
  } catch (error) {
    console.error("Error in PDF fill process:", error);
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

// Execute the function
fillRPLForm()
  .then((result) => {
    if (result.success) {
      console.log(`\n✅ SUCCESS: New PDF created and filled.`);
      console.log(`Open this file to check the results: ${result.outputPath}`);
    } else {
      console.log(`\n❌ ERROR: ${result.error}`);
      if (result.stack) {
        console.log(`\nStack trace:\n${result.stack}`);
      }
    }
  })
  .catch((err) => {
    console.error(`\n❌ FATAL ERROR: ${err.message}`);
    console.error(err.stack);
  });
