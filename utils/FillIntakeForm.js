const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Fill RPL Intake Form with data and upload to Firebase
 * @param {Object} formData - Form data from client
 * @param {String} applicationId - Application ID
 * @param {String} userId - User ID
 * @param {Object} db - Firestore database reference
 * @param {Object} bucket - Firebase storage bucket reference
 * @returns {Promise<Object>} Object with upload status and file URL
 */
const fillRPLIntakeForm = async (
  formData,
  applicationId,
  userId,
  db,
  bucket
) => {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), "pdf-forms");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Get the template PDF path - assuming it's stored in your project
    const templatePath = path.join(__dirname, "../RtoForms/rplIntakeForm.pdf");

    // Read the PDF template
    const pdfBytes = fs.readFileSync(templatePath);

    // Load the PDF document with ignoreEncryption option
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    // Get the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Function to add text at specific coordinates on a page
    const addTextToPage = (
      pageIndex,
      text,
      x,
      y,
      fontSize = 12,
      font = helveticaFont
    ) => {
      if (!text) return;
      const page = pdfDoc.getPage(pageIndex);
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    };

    // Function to add checkbox mark at specific coordinates
    const addCheckMark = (pageIndex, x, y, checked = true) => {
      if (!checked) return;
      const page = pdfDoc.getPage(pageIndex);
      page.drawText("✓", {
        x,
        y,
        size: 12,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
    };

    // Map coordinates for each field in the form
    // These coordinates would need to be determined by examining the PDF
    const fieldCoordinates = {
      // Student Declaration section (page 3)
      studentName: { page: 3, x: 180, y: 400 },
      courseQualification: { page: 3, x: 350, y: 400 },
      declarationDate: { page: 3, x: 180, y: 350 },
      studentSignature: { page: 3, x: 180, y: 320 },

      // Confirmation of Reassessment section (page 4)
      confirmStudentName: { page: 4, x: 200, y: 520 },
      confirmQualification: { page: 4, x: 200, y: 495 },
      confirmEmail: { page: 4, x: 180, y: 470 },
      confirmMobile: { page: 4, x: 180, y: 445 },
      confirmDOB: { page: 4, x: 180, y: 420 },

      // Self Assessment section (page 5-7)
      keySkills: { page: 5, x: 180, y: 175, maxWidth: 350 },
      workExperience: { page: 6, x: 180, y: 570, maxWidth: 350 },
      tasksResponsibilities: { page: 6, x: 180, y: 470, maxWidth: 350 },
      training: { page: 6, x: 180, y: 370, maxWidth: 350 },
      additionalSupport: { page: 6, x: 180, y: 270, maxWidth: 350 },

      // Self Assessment Competencies (page 7)
      selfAssessCompetencies: {
        "Apply waterproofing remedial processes": { page: 7, x: 125, y: 570 },
        "Apply waterproofing process to external above-ground wet areas": {
          page: 7,
          x: 125,
          y: 550,
        },
        "Apply waterproofing process to internal wet areas": {
          page: 7,
          x: 125,
          y: 530,
        },
        "Apply waterproofing system to below ground level wet areas": {
          page: 7,
          x: 125,
          y: 510,
        },
        "Prepare surfaces for waterproofing application": {
          page: 7,
          x: 125,
          y: 490,
        },
        "Use waterproofing tools and equipment": { page: 7, x: 125, y: 470 },
        "Handle waterproofing materials and components": {
          page: 7,
          x: 125,
          y: 450,
        },
        "Apply WHS requirements, policies and procedures in the construction industry":
          { page: 7, x: 125, y: 430 },
        "Carry out measurements and calculations": { page: 7, x: 125, y: 410 },
        "Read and interpret plans and specifications": {
          page: 7,
          x: 125,
          y: 390,
        },
        "Conduct workplace communication": { page: 7, x: 125, y: 370 },
        "Plan and organise work": { page: 7, x: 125, y: 350 },
        "Work effectively and sustainably in the construction industry": {
          page: 7,
          x: 125,
          y: 330,
        },
        "Carry out concreting to simple forms": { page: 7, x: 125, y: 310 },
        "Carry out basic demolition": { page: 7, x: 125, y: 290 },
        "Apply basic levelling procedures": { page: 7, x: 125, y: 270 },
        "Manage finances for new business ventures": {
          page: 7,
          x: 125,
          y: 250,
        },
        "Investigate business opportunities": { page: 7, x: 125, y: 230 },
        "Assess construction waterproofing processes": {
          page: 7,
          x: 125,
          y: 210,
        },
      },

      // Employment Verification section (page 8 and 9 for employer 1 and 2)
      employer1: {
        orgName: { page: 8, x: 350, y: 520 },
        supervisorName: { page: 8, x: 350, y: 495 },
        position: { page: 8, x: 350, y: 470 },
        contactNumber: { page: 8, x: 350, y: 445 },
        email: { page: 8, x: 350, y: 420 },
        employeeName: { page: 8, x: 350, y: 380 },
        jobTitle: { page: 8, x: 350, y: 355 },
        startDate: { page: 8, x: 220, y: 330 },
        endDate: { page: 8, x: 400, y: 330 },
        fullTime: { page: 8, x: 155, y: 305 },
        partTime: { page: 8, x: 230, y: 305 },
        casual: { page: 8, x: 305, y: 305 },
        duties: { page: 8, x: 180, y: 250, maxWidth: 350 },
      },

      employer2: {
        orgName: { page: 9, x: 350, y: 520 },
        supervisorName: { page: 9, x: 350, y: 495 },
        position: { page: 9, x: 350, y: 470 },
        contactNumber: { page: 9, x: 350, y: 445 },
        email: { page: 9, x: 350, y: 420 },
        employeeName: { page: 9, x: 350, y: 380 },
        jobTitle: { page: 9, x: 350, y: 355 },
        startDate: { page: 9, x: 220, y: 330 },
        endDate: { page: 9, x: 400, y: 330 },
        fullTime: { page: 9, x: 155, y: 305 },
        partTime: { page: 9, x: 230, y: 305 },
        casual: { page: 9, x: 305, y: 305 },
        duties: { page: 9, x: 180, y: 250, maxWidth: 350 },
      },

      // Referee Testimonial section (page 10-11)
      refStudentName: { page: 10, x: 420, y: 550 },
      refCompanyName: { page: 10, x: 350, y: 530 },
      refEmploymentPeriod: { page: 10, x: 200, y: 510 },
      refName: { page: 11, x: 180, y: 370 },
      refPosition: { page: 11, x: 180, y: 350 },
      refQualification: { page: 11, x: 350, y: 350 },
      refOrganisation: { page: 11, x: 180, y: 330 },
      refPhoneNumber: { page: 11, x: 180, y: 310 },
      refEmailAddress: { page: 11, x: 180, y: 290 },
      refSignature: { page: 11, x: 180, y: 250 },
      refDate: { page: 11, x: 350, y: 250 },

      // Referee Testimonial Competencies (page 10-11)
      refCompetencies: {
        "Work effectively and sustainably in the construction industry": {
          page: 10,
          x: 125,
          y: 230,
        },
        "Carry out measurements and calculations": { page: 10, x: 125, y: 210 },
        "Conduct workplace communication": { page: 10, x: 125, y: 190 },
        "Plan and organise work": { page: 10, x: 125, y: 170 },
        "Investigate business opportunities": { page: 10, x: 125, y: 150 },
        "Carry out concreting to simple forms": { page: 10, x: 125, y: 130 },
        "Carry out basic demolition": { page: 10, x: 125, y: 110 },
        "Apply basic levelling procedures": { page: 10, x: 125, y: 90 },
        "Manage finances for new business ventures": {
          page: 10,
          x: 125,
          y: 70,
        },
        "Read and interpret plans and specifications": {
          page: 10,
          x: 125,
          y: 50,
        },
        "Apply waterproofing remedial processes": { page: 11, x: 125, y: 190 },
        "Apply WHS requirements, policies and procedures in the construction industry":
          { page: 11, x: 125, y: 170 },
        "Assess construction waterproofing processes": {
          page: 11,
          x: 125,
          y: 70,
        },
        "Apply waterproofing process to external above-ground wet areas": {
          page: 11,
          x: 125,
          y: 150,
        },
        "Apply waterproofing system to below ground level wet areas": {
          page: 11,
          x: 125,
          y: 130,
        },
        "Prepare surfaces for waterproofing application": {
          page: 11,
          x: 125,
          y: 110,
        },
        "Use waterproofing tools and equipment": { page: 11, x: 125, y: 90 },
        "Handle waterproofing materials and components": {
          page: 11,
          x: 125,
          y: 150,
        },
        "Apply waterproofing process to internal wet areas": {
          page: 11,
          x: 125,
          y: 130,
        },
      },

      // Student initials (for all pages)
      studentInitials: [
        { page: 0, x: 105, y: 755 },
        { page: 1, x: 105, y: 755 },
        { page: 2, x: 105, y: 755 },
        { page: 3, x: 105, y: 755 },
        { page: 4, x: 105, y: 755 },
        { page: 5, x: 105, y: 755 },
        { page: 6, x: 105, y: 755 },
        { page: 7, x: 105, y: 755 },
        { page: 8, x: 105, y: 755 },
        { page: 9, x: 105, y: 755 },
        { page: 10, x: 105, y: 755 },
        { page: 11, x: 105, y: 755 },
      ],
    };

    // Helper function to break long text into multiple lines
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

      const page = pdfDoc.getPage(pageIndex);
      const words = text.split(" ");
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
    };

    // Fill in the Student Declaration section
    if (formData.studentDeclaration) {
      const { name, date, signature } = formData.studentDeclaration;
      const { page, x, y } = fieldCoordinates.studentName;
      addTextToPage(page, name, x, y);

      const courseCoords = fieldCoordinates.courseQualification;
      addTextToPage(
        courseCoords.page,
        formData.courseQualification,
        courseCoords.x,
        courseCoords.y
      );

      const dateCoords = fieldCoordinates.declarationDate;
      addTextToPage(dateCoords.page, date, dateCoords.x, dateCoords.y);

      const sigCoords = fieldCoordinates.studentSignature;
      addTextToPage(sigCoords.page, signature, sigCoords.x, sigCoords.y);

      // Add student initials to all pages
      const initials =
        name
          ?.split(" ")
          .map((n) => n[0])
          .join("") || "";
      fieldCoordinates.studentInitials.forEach((coords) => {
        addTextToPage(coords.page, initials, coords.x, coords.y, 12);
      });
    }

    // Fill in the Confirmation of Reassessment section
    if (formData.confirmationOfReassessment) {
      const { studentName, qualification, email, mobile, dob } =
        formData.confirmationOfReassessment;

      const nameCoords = fieldCoordinates.confirmStudentName;
      addTextToPage(nameCoords.page, studentName, nameCoords.x, nameCoords.y);

      const qualCoords = fieldCoordinates.confirmQualification;
      addTextToPage(qualCoords.page, qualification, qualCoords.x, qualCoords.y);

      const emailCoords = fieldCoordinates.confirmEmail;
      addTextToPage(emailCoords.page, email, emailCoords.x, emailCoords.y);

      const mobileCoords = fieldCoordinates.confirmMobile;
      addTextToPage(mobileCoords.page, mobile, mobileCoords.x, mobileCoords.y);

      const dobCoords = fieldCoordinates.confirmDOB;
      addTextToPage(dobCoords.page, dob, dobCoords.x, dobCoords.y);
    }

    // Fill in the Self Assessment section
    if (formData.selfAssessment) {
      const {
        keySkills,
        workExperience,
        tasksResponsibilities,
        training,
        additionalSupport,
        competencies,
      } = formData.selfAssessment;

      // Draw multiline text for each field
      const keySkillsCoords = fieldCoordinates.keySkills;
      drawMultilineText(
        keySkillsCoords.page,
        keySkills,
        keySkillsCoords.x,
        keySkillsCoords.y,
        keySkillsCoords.maxWidth
      );

      const workExpCoords = fieldCoordinates.workExperience;
      drawMultilineText(
        workExpCoords.page,
        workExperience,
        workExpCoords.x,
        workExpCoords.y,
        workExpCoords.maxWidth
      );

      const tasksCoords = fieldCoordinates.tasksResponsibilities;
      drawMultilineText(
        tasksCoords.page,
        tasksResponsibilities,
        tasksCoords.x,
        tasksCoords.y,
        tasksCoords.maxWidth
      );

      const trainingCoords = fieldCoordinates.training;
      drawMultilineText(
        trainingCoords.page,
        training,
        trainingCoords.x,
        trainingCoords.y,
        trainingCoords.maxWidth
      );

      const supportCoords = fieldCoordinates.additionalSupport;
      drawMultilineText(
        supportCoords.page,
        additionalSupport,
        supportCoords.x,
        supportCoords.y,
        supportCoords.maxWidth
      );

      // Fill in competencies checkboxes
      if (competencies) {
        Object.entries(competencies).forEach(([competency, value]) => {
          const competencyCoords =
            fieldCoordinates.selfAssessCompetencies[competency];
          if (competencyCoords && value === true) {
            addCheckMark(
              competencyCoords.page,
              competencyCoords.x,
              competencyCoords.y
            );
          }
        });
      }
    }

    // Fill in the Employer Verification section
    if (formData.employerVerification) {
      // Employer 1
      if (formData.employerVerification.employer1) {
        const employer = formData.employerVerification.employer1;
        const coords = fieldCoordinates.employer1;

        addTextToPage(
          coords.orgName.page,
          employer.orgName,
          coords.orgName.x,
          coords.orgName.y
        );
        addTextToPage(
          coords.supervisorName.page,
          employer.supervisorName,
          coords.supervisorName.x,
          coords.supervisorName.y
        );
        addTextToPage(
          coords.position.page,
          employer.position,
          coords.position.x,
          coords.position.y
        );
        addTextToPage(
          coords.contactNumber.page,
          employer.contactNumber,
          coords.contactNumber.x,
          coords.contactNumber.y
        );
        addTextToPage(
          coords.email.page,
          employer.email,
          coords.email.x,
          coords.email.y
        );
        addTextToPage(
          coords.employeeName.page,
          employer.employeeName,
          coords.employeeName.x,
          coords.employeeName.y
        );
        addTextToPage(
          coords.jobTitle.page,
          employer.jobTitle,
          coords.jobTitle.x,
          coords.jobTitle.y
        );
        addTextToPage(
          coords.startDate.page,
          employer.startDate,
          coords.startDate.x,
          coords.startDate.y
        );
        addTextToPage(
          coords.endDate.page,
          employer.endDate,
          coords.endDate.x,
          coords.endDate.y
        );

        // Set employment type checkbox
        if (employer.employmentType) {
          const empType = employer.employmentType.toLowerCase();
          if (empType === "full-time") {
            addCheckMark(
              coords.fullTime.page,
              coords.fullTime.x,
              coords.fullTime.y
            );
          } else if (empType === "part-time") {
            addCheckMark(
              coords.partTime.page,
              coords.partTime.x,
              coords.partTime.y
            );
          } else if (empType === "casual") {
            addCheckMark(coords.casual.page, coords.casual.x, coords.casual.y);
          }
        }

        // Draw multiline duties text
        drawMultilineText(
          coords.duties.page,
          employer.duties,
          coords.duties.x,
          coords.duties.y,
          coords.duties.maxWidth
        );
      }

      // Employer 2 (if provided)
      if (
        formData.employerVerification.employer2 &&
        formData.employerVerification.employer2.orgName
      ) {
        const employer = formData.employerVerification.employer2;
        const coords = fieldCoordinates.employer2;

        addTextToPage(
          coords.orgName.page,
          employer.orgName,
          coords.orgName.x,
          coords.orgName.y
        );
        addTextToPage(
          coords.supervisorName.page,
          employer.supervisorName,
          coords.supervisorName.x,
          coords.supervisorName.y
        );
        addTextToPage(
          coords.position.page,
          employer.position,
          coords.position.x,
          coords.position.y
        );
        addTextToPage(
          coords.contactNumber.page,
          employer.contactNumber,
          coords.contactNumber.x,
          coords.contactNumber.y
        );
        addTextToPage(
          coords.email.page,
          employer.email,
          coords.email.x,
          coords.email.y
        );
        addTextToPage(
          coords.employeeName.page,
          employer.employeeName,
          coords.employeeName.x,
          coords.employeeName.y
        );
        addTextToPage(
          coords.jobTitle.page,
          employer.jobTitle,
          coords.jobTitle.x,
          coords.jobTitle.y
        );
        addTextToPage(
          coords.startDate.page,
          employer.startDate,
          coords.startDate.x,
          coords.startDate.y
        );
        addTextToPage(
          coords.endDate.page,
          employer.endDate,
          coords.endDate.x,
          coords.endDate.y
        );

        // Set employment type checkbox
        if (employer.employmentType) {
          const empType = employer.employmentType.toLowerCase();
          if (empType === "full-time") {
            addCheckMark(
              coords.fullTime.page,
              coords.fullTime.x,
              coords.fullTime.y
            );
          } else if (empType === "part-time") {
            addCheckMark(
              coords.partTime.page,
              coords.partTime.x,
              coords.partTime.y
            );
          } else if (empType === "casual") {
            addCheckMark(coords.casual.page, coords.casual.x, coords.casual.y);
          }
        }

        // Draw multiline duties text
        drawMultilineText(
          coords.duties.page,
          employer.duties,
          coords.duties.x,
          coords.duties.y,
          coords.duties.maxWidth
        );
      }
    }

    // Fill in the Referee Testimonial section
    if (formData.refereeTestimonial) {
      const testimonial = formData.refereeTestimonial;

      addTextToPage(
        fieldCoordinates.refStudentName.page,
        testimonial.studentName,
        fieldCoordinates.refStudentName.x,
        fieldCoordinates.refStudentName.y
      );
      addTextToPage(
        fieldCoordinates.refCompanyName.page,
        testimonial.companyName,
        fieldCoordinates.refCompanyName.x,
        fieldCoordinates.refCompanyName.y
      );
      addTextToPage(
        fieldCoordinates.refEmploymentPeriod.page,
        testimonial.employmentPeriod,
        fieldCoordinates.refEmploymentPeriod.x,
        fieldCoordinates.refEmploymentPeriod.y
      );
      addTextToPage(
        fieldCoordinates.refName.page,
        testimonial.refereeName,
        fieldCoordinates.refName.x,
        fieldCoordinates.refName.y
      );
      addTextToPage(
        fieldCoordinates.refPosition.page,
        testimonial.position,
        fieldCoordinates.refPosition.x,
        fieldCoordinates.refPosition.y
      );
      addTextToPage(
        fieldCoordinates.refQualification.page,
        testimonial.qualification,
        fieldCoordinates.refQualification.x,
        fieldCoordinates.refQualification.y
      );
      addTextToPage(
        fieldCoordinates.refOrganisation.page,
        testimonial.organisation,
        fieldCoordinates.refOrganisation.x,
        fieldCoordinates.refOrganisation.y
      );
      addTextToPage(
        fieldCoordinates.refPhoneNumber.page,
        testimonial.phoneNumber,
        fieldCoordinates.refPhoneNumber.x,
        fieldCoordinates.refPhoneNumber.y
      );
      addTextToPage(
        fieldCoordinates.refEmailAddress.page,
        testimonial.emailAddress,
        fieldCoordinates.refEmailAddress.x,
        fieldCoordinates.refEmailAddress.y
      );
      addTextToPage(
        fieldCoordinates.refSignature.page,
        testimonial.signature,
        fieldCoordinates.refSignature.x,
        fieldCoordinates.refSignature.y
      );
      addTextToPage(
        fieldCoordinates.refDate.page,
        testimonial.date,
        fieldCoordinates.refDate.x,
        fieldCoordinates.refDate.y
      );

      // Fill in competencies checkboxes
      if (testimonial.competencies) {
        Object.entries(testimonial.competencies).forEach(
          ([competency, value]) => {
            const competencyCoords =
              fieldCoordinates.refCompetencies[competency];
            if (competencyCoords && value === true) {
              addCheckMark(
                competencyCoords.page,
                competencyCoords.x,
                competencyCoords.y
              );
            }
          }
        );
      }
    }

    // Save the filled form
    const filledPdfBytes = await pdfDoc.save();

    // Generate a unique filename
    const timestamp = Date.now();
    const fileName = `RPL_Intake_${applicationId}_${timestamp}.pdf`;
    const tempFilePath = path.join(tempDir, fileName);

    // Write the filled PDF to temp file
    fs.writeFileSync(tempFilePath, filledPdfBytes);

    // Upload to Firebase Storage
    const fileBuffer = fs.readFileSync(tempFilePath);
    const fileUploadPath = `applications/${userId}/${applicationId}/forms/${fileName}`;
    const fileRef = bucket.file(fileUploadPath);

    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: "application/pdf",
      },
    });

    // Get the download URL
    const [url] = await fileRef.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // Long-lived URL
    });

    // Update the application with the form URL
    await db.collection("applications").doc(applicationId).update({
      rplIntakeFormUrl: url,
      updatedAt: new Date().toISOString(),
    });

    // Clean up the temp file
    fs.unlinkSync(tempFilePath);

    return {
      success: true,
      fileUrl: url,
    };
  } catch (error) {
    console.error("Error filling RPL Intake form:", error);
    throw new Error(`Failed to fill RPL Intake form: ${error.message}`);
  }
};

module.exports = {
  fillRPLIntakeForm,
};
