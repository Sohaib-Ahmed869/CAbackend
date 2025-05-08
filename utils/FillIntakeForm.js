// utils/FillRPLForm.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const PDFDocument = require("pdfkit");

/**
 * Fill RPL Assessment Form by creating a new PDF from scratch
 * @param {Object} formData - The form data to fill in the PDF
 * @param {string} applicationId - The application ID
 * @param {string} userId - The user ID
 * @param {Object} db - Firestore database reference
 * @param {Object} bucket - Firebase storage bucket reference
 * @returns {Promise<Object>} - Promise resolving to an object with file URL
 */
const fillRPLIntakeForm = async (
  formData,
  applicationId,
  userId,
  db,
  bucket
) => {
  try {
    // Create a new PDF document instead of trying to fill an existing one
    const tempFilePath = path.join(
      os.tmpdir(),
      `rpl_form_${applicationId}.pdf`
    );

    // Create a document
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: "RPL Assessment Form",
        Author: "Certified Australia",
        Subject: "Recognition of Prior Learning Assessment",
      },
    });

    // Pipe output to file
    const stream = fs.createWriteStream(tempFilePath);
    doc.pipe(stream);

    // Helper function to add a title
    const addTitle = (text, fontSize = 16) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(fontSize)
        .text(text, { align: "center" });
      doc.moveDown();
    };

    // Helper function to add a section heading
    const addHeading = (text, fontSize = 12) => {
      doc.font("Helvetica-Bold").fontSize(fontSize).text(text);
      doc.moveDown(0.5);
    };

    // Helper function to add a form field
    const addField = (label, value, options = {}) => {
      const defaultOptions = {
        continued: false,
        indent: 20,
        paragraphGap: 5,
        width: 450,
        align: "left",
      };
      const mergedOptions = { ...defaultOptions, ...options };

      doc.font("Helvetica-Bold").text(`${label}:`, mergedOptions);
      doc
        .font("Helvetica")
        .text(value || "N/A", {
          ...mergedOptions,
          indent: mergedOptions.indent + 10,
        });
      doc.moveDown();
    };

    // Helper function to add a checkbox field
    const addCheckbox = (label, isChecked) => {
      doc
        .font("Helvetica")
        .text(`[${isChecked ? "X" : " "}] ${label}`, { continued: false });
      doc.moveDown(0.5);
    };

    // Add logo (if available)
    // doc.image('path/to/logo.png', { width: 150, align: 'center' });

    // Add title
    addTitle("Recognition of Prior Learning (RPL) Assessment Form", 18);
    doc.moveDown();

    // Add header information
    doc
      .font("Helvetica")
      .fontSize(10)
      .text("Certified Australia", { align: "right" });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: "right" });
    doc.text(`Reference: RPL-${applicationId}`, { align: "right" });
    doc.moveDown(2);

    // ------------------------------------------
    // Student Details Section
    // ------------------------------------------
    addHeading("1. Student Details", 14);

    if (formData.studentDetails) {
      addField("Name", formData.studentDetails.name);
    }

    addField("Course/Qualification", formData.courseQualification);
    addField("Date", new Date().toLocaleDateString());

    doc.moveDown();

    // ------------------------------------------
    // Declaration Section
    // ------------------------------------------
    addHeading("2. Declaration Statements", 14);

    // Add declaration bullets
    const declarations = [
      "I declare that the evidence provided for the RPL assessment is true, accurate, and authentic.",
      "I confirm that all documentation submitted is my own or has been obtained with proper authorisation.",
      "I agree to comply with all RPL process requirements, including submitting any additional evidence requested by the assessor.",
      "I understand that any false or misleading information may result in the rejection of my RPL application.",
      "I acknowledge that the RTO may contact my employer, referee, or other relevant parties to verify the authenticity of the evidence provided.",
      "I have been informed of my rights to appeal the assessment outcome if required.",
    ];

    declarations.forEach((declaration) => {
      doc.font("Helvetica").fontSize(10).text(`• ${declaration}`, {
        indent: 10,
        continued: false,
        width: 450,
        align: "left",
      });
      doc.moveDown(0.5);
    });

    doc.moveDown();

    // Student signature section
    addHeading("3. Student Acknowledgement", 14);
    addField("Student Name", formData.studentDetails?.name);
    doc.moveDown();

    // Add signature line
    doc.lineWidth(1).moveTo(50, doc.y).lineTo(250, doc.y).stroke();

    doc.text("Signature", 50, doc.y + 5);

    // Add date line
    doc
      .lineWidth(1)
      .moveTo(300, doc.y - 5)
      .lineTo(500, doc.y - 5)
      .stroke();

    doc.text("Date", 300, doc.y);

    doc.moveDown(2);

    // ------------------------------------------
    // Confirmation of Assessment
    // ------------------------------------------
    addHeading("4. Confirmation of Assessment", 14);

    if (formData.studentInfo) {
      addField("Student Name", formData.studentDetails?.name);
      addField("Qualification", formData.courseQualification);
      addField("Email", formData.studentInfo.email);
      addField("Mobile", formData.studentInfo.mobile);
      addField("Date of Birth", formData.studentInfo.dob);
    }

    doc.moveDown();

    // Add a page break
    doc.addPage();

    // ------------------------------------------
    // Self-Assessment
    // ------------------------------------------
    addHeading(
      "5. Recognition of Prior Learning (RPL) Student Self-Assessment",
      14
    );

    if (formData.selfAssessment) {
      // Question 1
      addField(
        "What are your key skills and strengths relevant to this qualification?",
        formData.selfAssessment.keySkills,
        { paragraphGap: 10 }
      );

      // Question 2
      addField(
        "Describe your work experience and how it relates to the units of competency in this course",
        formData.selfAssessment.workExperience,
        { paragraphGap: 10 }
      );

      // Question 3
      addField(
        "What specific tasks or responsibilities have you performed in your workplace that demonstrate your competency?",
        formData.selfAssessment.specificTasks,
        { paragraphGap: 10 }
      );

      // Question 4
      addField(
        "Have you undertaken any formal or informal training relevant to this qualification?",
        formData.selfAssessment.formalTraining,
        { paragraphGap: 10 }
      );

      // Question 5
      addField(
        "Are there any areas where you feel you need additional training or support?",
        formData.selfAssessment.additionalTraining,
        { paragraphGap: 10 }
      );
    }

    doc.moveDown();

    // ------------------------------------------
    // Competencies Section
    // ------------------------------------------
    addHeading("6. Alignment with Competencies", 14);
    doc
      .font("Helvetica")
      .text(
        "Please review the units of competency for this qualification and indicate whether you believe you are competent in each area:"
      );
    doc.moveDown();

    // Standard competencies for waterproofing
    const allCompetencies = [
      "Investigate business opportunities",
      "Manage finances for new business ventures",
      "Apply basic levelling procedures",
      "Carry out basic demolition",
      "Carry out concreting to simple forms",
      "Work effectively and sustainably in the construction industry",
      "Plan and organise work",
      "Conduct workplace communication",
      "Carry out measurements and calculations",
      "Read and interpret plans and specifications",
      "Apply WHS requirements, policies and procedures in the construction industry",
      "Handle waterproofing materials and components",
      "Use waterproofing tools and equipment",
      "Prepare surfaces for waterproofing application",
      "Apply waterproofing system to below ground level wet areas",
      "Apply waterproofing process to internal wet areas",
      "Apply waterproofing process to external above-ground wet areas",
      "Apply waterproofing remedial processes",
      "Assess construction waterproofing processes",
    ];

    // Track claimed competencies
    const claimedCompetencies = formData.competencies || [];

    // Add each competency as a checkbox
    allCompetencies.forEach((competency) => {
      const isChecked = claimedCompetencies.includes(competency);
      addCheckbox(competency, isChecked);
    });

    doc.moveDown();

    // Add a page break
    doc.addPage();

    // ------------------------------------------
    // Employment Verification
    // ------------------------------------------
    addHeading("7. Employment Verification", 14);

    if (formData.employers && formData.employers.length > 0) {
      // Handle each employer
      formData.employers.forEach((employer, index) => {
        addHeading(`Employer ${index + 1}`, 12);

        addField("Employer/Organisation", employer.organisationName);
        addField("Supervisor/Manager Name", employer.supervisorName);
        addField("Position/Title", employer.supervisorPosition);
        addField("Contact Number", employer.contactNumber);
        addField("Email Address", employer.email);
        addField("Employee Name", formData.studentDetails?.name);
        addField("Job Title", employer.jobTitle);
        addField("Start Date", employer.startDate);
        addField("End Date", employer.endDate);

        // Employment type
        doc.font("Helvetica-Bold").text("Employment Type:");
        addCheckbox("Full-Time", employer.employmentType === "Full-Time");
        addCheckbox("Part-Time", employer.employmentType === "Part-Time");
        addCheckbox("Casual", employer.employmentType === "Casual");

        // Description of duties
        addField("Description of Duties", employer.dutiesDescription, {
          paragraphGap: 10,
        });

        // Employer signature
        doc.moveDown();

        // Add signature line
        doc.lineWidth(1).moveTo(50, doc.y).lineTo(250, doc.y).stroke();

        doc.text("Employer Signature", 50, doc.y + 5);

        // Add date line
        doc
          .lineWidth(1)
          .moveTo(300, doc.y - 5)
          .lineTo(500, doc.y - 5)
          .stroke();

        doc.text("Date", 300, doc.y);

        doc.moveDown(2);
      });
    }

    // Add a page break if needed
    if (doc.y > 650) {
      doc.addPage();
    } else {
      doc.moveDown(2);
    }

    // ------------------------------------------
    // Referee Testimonial
    // ------------------------------------------
    addHeading(
      "8. Referee Testimonial and Skills Verification Declaration",
      14
    );

    if (formData.refereeTestimonial) {
      addField("Student Name", formData.studentDetails?.name);
      addField("Qualification", formData.courseQualification);
      addField(
        "Employment Period",
        formData.refereeTestimonial.employmentPeriod
      );

      doc.moveDown();

      addHeading("Referee Contact Details:", 12);
      addField("Name", formData.refereeTestimonial.refereeName);
      addField(
        "Qualification/Licence Details",
        formData.refereeTestimonial.qualificationDetails
      );
      addField("Position", formData.refereeTestimonial.position);
      addField("Organisation", formData.refereeTestimonial.organisation);
      addField("Phone Number", formData.refereeTestimonial.phoneNumber);
      addField("Email Address", formData.refereeTestimonial.email);

      doc.moveDown();

      // Referee signature
      // Add signature line
      doc.lineWidth(1).moveTo(50, doc.y).lineTo(250, doc.y).stroke();

      doc.text("Referee Signature", 50, doc.y + 5);

      // Add date line
      doc
        .lineWidth(1)
        .moveTo(300, doc.y - 5)
        .lineTo(500, doc.y - 5)
        .stroke();

      doc.text("Date", 300, doc.y);
    }

    // Finalize the PDF
    doc.end();

    // Wait for the writing to finish
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    // 6. Upload the file to Firebase Storage
    const storageFilePath = `rpl_forms/${userId}/${applicationId}_rpl_form.pdf`;
    await bucket.upload(tempFilePath, {
      destination: storageFilePath,
      metadata: {
        contentType: "application/pdf",
      },
    });

    // 7. Get the download URL
    const [url] = await bucket.file(storageFilePath).getSignedUrl({
      action: "read",
      expires: "03-01-2500", // Long expiration for demonstration purposes
    });

    // 8. Clean up the temporary file
    fs.unlinkSync(tempFilePath);

    // 9. Update the application record in Firestore with the form URL
    await db.collection("applications").doc(applicationId).update({
      rplIntakeFormUrl: url,
      rplIntakeFormPath: storageFilePath,
      rplIntakeFormGeneratedAt: new Date().toISOString(),
    });

    // 10. Return the file URL
    return {
      success: true,
      fileUrl: url,
    };
  } catch (error) {
    console.error("Error creating RPL form:", error);
    throw new Error(`Failed to create RPL form: ${error.message}`);
  }
};

module.exports = {
  fillRPLIntakeForm,
};
