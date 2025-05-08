// utils/FillRPLForm.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  UnderlineType,
  BorderStyle,
  Tab,
  TabStopPosition,
  TabStopType,
  CheckBox,
  Table,
  TableRow,
  TableCell,
  WidthType,
} = require("docx");

/**
 * Fill RPL Assessment Form by creating a new DOCX document from scratch
 * @param {Object} formData - The form data to fill in the document
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
    // Create a temporary file path
    const tempFilePath = path.join(
      os.tmpdir(),
      `rpl_form_${applicationId}.docx`
    );

    // Helper function to create a title paragraph
    const createTitle = (text, level = HeadingLevel.HEADING_1) => {
      return new Paragraph({
        text: text,
        heading: level,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      });
    };

    // Helper function to create a heading paragraph
    const createHeading = (text, level = HeadingLevel.HEADING_2) => {
      return new Paragraph({
        text: text,
        heading: level,
        spacing: { before: 200, after: 100 },
      });
    };

    // Helper function to create a normal paragraph
    const createParagraph = (text, options = {}) => {
      const defaultOptions = {
        alignment: AlignmentType.LEFT,
        spacing: { before: 100, after: 100 },
        indent: { left: 0 },
      };
      const mergedOptions = { ...defaultOptions, ...options };

      if (options.bold) {
        return new Paragraph({
          children: [
            new TextRun({
              text: text,
              bold: true,
            }),
          ],
          ...mergedOptions,
        });
      }

      return new Paragraph({
        text: text,
        ...mergedOptions,
      });
    };

    // Helper function to create a form field
    const createFormField = (label, value = "", options = {}) => {
      const defaultOptions = {
        spacing: { before: 100, after: 100 },
      };
      const mergedOptions = { ...defaultOptions, ...options };

      return new Paragraph({
        children: [
          new TextRun({
            text: label,
            bold: true,
          }),
          new TextRun({
            text: value || "",
            underline: {
              type: UnderlineType.SINGLE,
            },
          }),
        ],
        ...mergedOptions,
      });
    };

    // Helper function to create a bullet point
    const createBullet = (text, options = {}) => {
      const defaultOptions = {
        indent: { left: 720 },
        spacing: { before: 100, after: 100 },
      };
      const mergedOptions = { ...defaultOptions, ...options };

      return new Paragraph({
        text: text,
        bullet: { level: 0 },
        ...mergedOptions,
      });
    };

    // Helper function to create a checkbox field
    const createCheckboxField = (text, isChecked = false, options = {}) => {
      const defaultOptions = {
        indent: { left: 720 },
        spacing: { before: 100, after: 100 },
      };
      const mergedOptions = { ...defaultOptions, ...options };

      const checkSymbol = isChecked ? "☑" : "☐";

      return new Paragraph({
        children: [
          new TextRun({
            text: `${checkSymbol} ${text}`,
          }),
        ],
        ...mergedOptions,
      });
    };

    // Helper function to create a signature line
    const createSignatureLine = (
      label = "Signature",
      signatureText = "",
      options = {}
    ) => {
      const defaultOptions = {
        spacing: { before: 300, after: 100 },
      };
      const mergedOptions = { ...defaultOptions, ...options };

      if (signatureText) {
        return new Paragraph({
          children: [
            new TextRun({
              text: signatureText,
              font: "Brush Script MT", // More widely available signature font
              size: 40, // Made even larger
              italics: true, // Added italics for signature look
              color: "000000", // Ensures black color
            }),
            new TextRun({
              text: "\n",
              break: 1,
            }),
            new TextRun({
              text: label,
              bold: true,
            }),
          ],
          ...mergedOptions,
        });
      } else {
        return new Paragraph({
          children: [
            new TextRun({
              text: "____________________________",
            }),
            new TextRun({
              text: "\n",
              break: 1,
            }),
            new TextRun({
              text: label,
              bold: true,
            }),
          ],
          ...mergedOptions,
        });
      }
    };

    // Helper function to create a text box for longer text inputs
    const createTextBox = (text = "", options = {}) => {
      const defaultOptions = {
        spacing: { before: 100, after: 100 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
        },
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
      };
      const mergedOptions = { ...defaultOptions, ...options };

      return new Paragraph({
        text: text || "",
        ...mergedOptions,
      });
    };

    // Extract relevant data from formData
    const {
      studentDeclaration,
      courseQualification,
      confirmationOfReassessment,
      selfAssessment,
      employerVerification,
      refereeTestimonial,
    } = formData;

    // Get list of competencies from selfAssessment.competencies
    const competenciesList = Object.keys(selfAssessment.competencies || {});

    // Create document sections/content
    const doc = new Document({
      title: "RPL Assessment Form",
      description: "Recognition of Prior Learning Assessment",
      sections: [
        {
          properties: {},
          children: [
            // COVER LETTER
            createTitle("Cover Letter for RPL Assessment Completion"),
            createParagraph("Dear Student,"),
            createParagraph(
              "We are reaching out to guide you through the next steps of your Recognition of Prior Learning (RPL) assessment process. As part of your assessment, you are required to complete specific sections of the assessment to ensure compliance and provide the necessary evidence for your qualification."
            ),
            createParagraph(
              "Below are the details of the sections that require your attention:"
            ),

            createHeading("RPL Assessment Checklist", HeadingLevel.HEADING_2),

            createParagraph("1. Initial Steps", { bold: true }),
            createBullet("[ ] Student Application Received"),
            createBullet("[ ] Confirmation of Enrolment (COE) Issued"),
            createBullet("[ ] Student Declaration Signed"),

            createParagraph("2. Evidence Collection", { bold: true }),
            createBullet("[ ] Photos or Videos of Tasks Performed"),
            createBullet("[ ] Payslips or Employment Contracts"),
            createBullet("[ ] Previous Certificates or Qualifications"),
            createBullet("[ ] Work Samples (Reports, Documentation, etc.)"),
            createBullet("[ ] Referee Testimonials and Declarations"),
            createBullet("[ ] Employer Verification"),
            createBullet("[ ] Student Self-Assessment"),

            createParagraph("3. Assessment Process", { bold: true }),
            createBullet("[ ] Competency Mapping Completed"),
            createBullet("[ ] Competency Conversation Conducted"),
            createBullet("[ ] Skills Observation Checklist Completed"),
            createBullet("[ ] Third-Party RPL Kit Completed by Assessor"),
            createBullet("[ ] Evidence Authentication Verified"),

            createParagraph("4. Compliance and Reporting", { bold: true }),
            createBullet("[ ] Assessor's Final Decision Recorded"),
            createBullet("[ ] Student Feedback Survey Issued"),
            createBullet("[ ] Records Management Completed"),
            createBullet("[ ] Appeals Process Communicated"),

            createParagraph("5. Post-Assessment Steps", { bold: true }),
            createBullet("[ ] Certification Issued"),
            createBullet("[ ] Gap Training Plan Provided (If Required)"),
            createBullet(
              "[ ] Compliance Review Conducted; including validation"
            ),

            createHeading("Outcome of Assessment", HeadingLevel.HEADING_2),
            createParagraph(
              "Upon completing the submission for assessment, we will inform you of the outcome of your RPL assessment."
            ),

            createParagraph("Sections to Be Completed by you:", { bold: true }),
            createParagraph("1. Declaration", { bold: true }),
            createParagraph(
              "Please complete and sign the student declaration form provided. This is a mandatory step to confirm your understanding of the RPL process and compliance with our requirements."
            ),

            createParagraph("2. Evidence Collection", { bold: true }),
            createParagraph(
              "Submit all relevant supporting documents as listed below:"
            ),
            createBullet("Photos or videos of tasks you have performed."),
            createBullet(
              "Pay slips or employment contracts as proof of work experience."
            ),
            createBullet(
              "Copies of any previous certificates or qualifications."
            ),
            createBullet(
              "Samples of your work, such as reports or documentation."
            ),
            createBullet(
              "Complete the self-assessment form provided to reflect your competency levels."
            ),
            createBullet(
              "Referee testimonials and declarations from employers or colleagues."
            ),
            createBullet(
              "Employer verification confirming your roles and responsibilities."
            ),

            createParagraph("Next Steps:", { bold: true }),
            createParagraph(
              "Once you have completed the required sections, please ensure all documents are emailed directly to our support team at info@certifiedaustralia.com.au. Our team will review your submission and notify you if any additional information is required."
            ),
            createParagraph(
              "If you have any questions or need assistance with completing these sections, please do not hesitate to contact us. Our email is info@certifiedaustralia.com.au."
            ),
            createParagraph("Best regards,"),
            createParagraph("Certified Australia"),

            // Page break
            new Paragraph({
              text: "",
              pageBreakBefore: true,
            }),

            // STUDENT DECLARATION
            createTitle(
              "Recognition of Prior Learning (RPL) Student Declaration"
            ),
            createParagraph(
              "This declaration is a formal statement from the student acknowledging their participation in the RPL process and agreeing to the terms and conditions outlined by the RTO (Registered Training Organisation). See RTO handbook for more information."
            ),

            createParagraph("1. Student Details", { bold: true }),
            createFormField("Name: ", studentDeclaration.name || ""),
            createFormField(
              "Course/Qualification: ",
              courseQualification || ""
            ),
            createFormField(
              "Date: ",
              studentDeclaration.date || new Date().toLocaleDateString()
            ),

            createParagraph("2. Declaration Statements", { bold: true }),
            createBullet(
              "I declare that the evidence provided for the RPL assessment is true, accurate, and authentic."
            ),
            createBullet(
              "I confirm that all documentation submitted is my own or has been obtained with proper authorisation."
            ),
            createBullet(
              "I agree to comply with all RPL process requirements, including submitting any additional evidence requested by the assessor."
            ),
            createBullet(
              "I understand that any false or misleading information may result in the rejection of my RPL application."
            ),
            createBullet(
              "I acknowledge that the RTO may contact my employer, referee, or other relevant parties to verify the authenticity of the evidence provided."
            ),
            createBullet(
              "I have been informed of my rights to appeal the assessment outcome if required."
            ),
            createBullet(
              "More information can be found at https://www.asqa.gov.au/guidance-resources/resources-providers/faqs/recognition-prior-learning-rpl"
            ),

            createParagraph("3. Student Acknowledgement", { bold: true }),
            createParagraph(
              `I, ${
                studentDeclaration.name || "_______________________"
              } (Student Name), have read and understood the above statements. I agree to the terms and conditions outlined as part of the RPL process.`
            ),

            createSignatureLine(
              "Signature",
              studentDeclaration.signature || ""
            ),
            createFormField("Date: ", studentDeclaration.date || ""),

            createParagraph("4. Acknowledgement", { bold: true }),
            createParagraph(
              `I, _______________________ (Certified Australia Representative), confirm that I have explained the RPL process and requirements to the student.`
            ),

            createSignatureLine("Signature"),
            createSignatureLine("Date"),

            // Page break
            new Paragraph({
              text: "",
              pageBreakBefore: true,
            }),

            // CONFIRMATION OF ASSESSMENT
            createTitle("Confirmation of Assessment"),

            createHeading("STUDENT INFORMATION", HeadingLevel.HEADING_2),

            createFormField(
              "Student Name: ",
              confirmationOfReassessment.studentName || ""
            ),
            createFormField(
              "Qualification: ",
              confirmationOfReassessment.qualification ||
                courseQualification ||
                ""
            ),
            createFormField("Email: ", confirmationOfReassessment.email || ""),
            createFormField(
              "Mobile: ",
              confirmationOfReassessment.mobile || ""
            ),
            createFormField("D.O.B: ", confirmationOfReassessment.dob || ""),

            createParagraph("Dear student,"),
            createParagraph(
              "Thank you for your patience during the reassessment process. This document confirms that your RPL application will be reassessed as part of our compliance procedures."
            ),
            createParagraph(
              "You are required to complete the 'Declaration' and 'Evidence Collection' sections as part of this reassessment process. All required documents will be provided to assist you in this process."
            ),
            createParagraph(
              "Below is the completed checklist outlining the steps to be undertaken during the reassessment:"
            ),

            createHeading("Outcome of Assessment", HeadingLevel.HEADING_2),
            createParagraph(
              "Upon completing the submission for reassessment, we will inform you of the outcome of your RPL reassessment."
            ),

            createParagraph("Certified Australia", {
              alignment: AlignmentType.RIGHT,
            }),

            // Page break
            new Paragraph({
              text: "",
              pageBreakBefore: true,
            }),

            // SELF-ASSESSMENT
            createTitle(
              "Recognition of Prior Learning (RPL) Student Self-Assessment"
            ),
            createParagraph(
              "This self-assessment form allows students to reflect on their skills, knowledge, and experience. Please complete this form to the best of your ability, providing specific examples where possible."
            ),

            createParagraph("1. Student Details", { bold: true }),
            createFormField("Name: ", studentDeclaration.name || ""),
            createFormField(
              "Course/Qualification: ",
              courseQualification || ""
            ),

            createParagraph("2. Self-Assessment Questions", { bold: true }),
            createParagraph("Please answer the following questions in detail."),

            createParagraph(
              "1. What are your key skills and strengths relevant to this qualification?",
              { bold: true }
            ),
            createTextBox(selfAssessment.keySkills || "", { height: 200 }),

            createParagraph(
              "2. Describe your work experience and how it relates to the units of competency in this course (briefly outline your industry experience).",
              { bold: true }
            ),
            createTextBox(selfAssessment.workExperience || "", { height: 200 }),

            createParagraph(
              "3. What specific tasks or responsibilities have you performed in your workplace that demonstrate your competency?",
              { bold: true }
            ),
            createTextBox(selfAssessment.tasksResponsibilities || "", {
              height: 200,
            }),

            createParagraph(
              "4. Have you undertaken any formal or informal training relevant to this qualification? If yes, please provide details.",
              { bold: true }
            ),
            createTextBox(selfAssessment.training || "", { height: 200 }),

            createParagraph(
              "5. Are there any areas where you feel you need additional training or support? If yes, please explain.",
              { bold: true }
            ),
            createTextBox(selfAssessment.additionalSupport || "", {
              height: 200,
            }),

            // Page break
            new Paragraph({
              text: "",
              pageBreakBefore: true,
            }),

            // COMPETENCIES
            createParagraph("3. Alignment with Competencies", { bold: true }),
            createParagraph(
              "Please review the units of competency for this qualification and indicate whether you believe you are competent in each area:"
            ),

            // Map through competencies from selfAssessment.competencies
            ...competenciesList.map((competency) =>
              createCheckboxField(
                competency,
                selfAssessment.competencies[competency] || false
              )
            ),

            createParagraph("4. Student Declaration", { bold: true }),
            createParagraph(
              `I, ${
                studentDeclaration.name || "_______________________"
              } (Student Name), declare that the information provided in this self-assessment is accurate and true to the best of my knowledge. I understand that this self-assessment will be used as part of the RPL process and may require verification.`
            ),

            createSignatureLine("Signature"),
            createFormField("Date: ", studentDeclaration.date || ""),

            // Page break
            new Paragraph({
              text: "",
              pageBreakBefore: true,
            }),

            // EMPLOYMENT VERIFICATION (1/2)
            createTitle("Employment Verification Document (1/2)"),
            createParagraph(
              "This form is used to verify the employment details of a student applying for Recognition of Prior Learning (RPL). It must be completed by the student's employer or supervisor."
            ),

            createParagraph("1. Employer Details", { bold: true }),
            createFormField(
              "Name of Employer/Organisation: ",
              employerVerification.employer1.orgName || ""
            ),
            createFormField(
              "Supervisor/Manager Name: ",
              employerVerification.employer1.supervisorName || ""
            ),
            createFormField(
              "Position/Title: ",
              employerVerification.employer1.position || ""
            ),
            createFormField(
              "Contact Number: ",
              employerVerification.employer1.contactNumber || ""
            ),
            createFormField(
              "Email Address: ",
              employerVerification.employer1.email || ""
            ),

            createParagraph("2. Employment Details", { bold: true }),
            createFormField(
              "Employee Name: ",
              employerVerification.employer1.employeeName || ""
            ),
            createFormField(
              "Job Title: ",
              employerVerification.employer1.jobTitle || ""
            ),
            createFormField(
              "Start Date: ",
              employerVerification.employer1.startDate || ""
            ),
            createFormField(
              "End Date: ",
              employerVerification.employer1.endDate || ""
            ),

            // Employment Type checkboxes
            createParagraph("Employment Type:", { bold: true }),
            createCheckboxField(
              "Full-Time",
              employerVerification.employer1.employmentType === "Full-Time"
            ),
            createCheckboxField(
              "Part-Time",
              employerVerification.employer1.employmentType === "Part-Time"
            ),
            createCheckboxField(
              "Casual",
              employerVerification.employer1.employmentType === "Casual"
            ),

            createParagraph("3. Description of Duties", { bold: true }),
            createParagraph(
              "Please provide a detailed description of the student's duties and responsibilities; include any additional comments:"
            ),
            createTextBox(employerVerification.employer1.duties || "", {
              height: 200,
            }),

            createParagraph("4. Alignment with Competencies", { bold: true }),
            createParagraph(
              "Please confirm which of the following competencies the student demonstrated during their employment. Refer to the attached relevant referee testimonial and skills verification declaration."
            ),

            createParagraph("6. Employer Declaration", { bold: true }),
            createParagraph(
              `I, ${
                employerVerification.employer1.supervisorName ||
                "_______________________"
              } (Employer/Supervisor Name), confirm that the above information is accurate and true to the best of my knowledge.`
            ),

            createSignatureLine(
              "Signature",
              employerVerification.employer1.supervisorName || ""
            ),
            createFormField("Date: ", ""),

            // Page break
            new Paragraph({
              text: "",
              pageBreakBefore: true,
            }),

            // EMPLOYMENT VERIFICATION (2/2) - If applicable
            createTitle(
              "Employment Verification Document (2/2) (if applicable)"
            ),
            createParagraph(
              "This form is used to verify the employment details of a student applying for Recognition of Prior Learning (RPL). It must be completed by the student's employer or supervisor."
            ),

            createParagraph("1. Employer Details", { bold: true }),
            createFormField(
              "Name of Employer/Organisation: ",
              employerVerification.employer2.orgName || ""
            ),
            createFormField(
              "Supervisor/Manager Name: ",
              employerVerification.employer2.supervisorName || ""
            ),
            createFormField(
              "Position/Title: ",
              employerVerification.employer2.position || ""
            ),
            createFormField(
              "Contact Number: ",
              employerVerification.employer2.contactNumber || ""
            ),
            createFormField(
              "Email Address: ",
              employerVerification.employer2.email || ""
            ),

            createParagraph("2. Employment Details", { bold: true }),
            createFormField(
              "Employee Name: ",
              employerVerification.employer2.employeeName || ""
            ),
            createFormField(
              "Job Title: ",
              employerVerification.employer2.jobTitle || ""
            ),
            createFormField(
              "Start Date: ",
              employerVerification.employer2.startDate || ""
            ),
            createFormField(
              "End Date: ",
              employerVerification.employer2.endDate || ""
            ),

            // Employment Type checkboxes
            createParagraph("Employment Type:", { bold: true }),
            createCheckboxField(
              "Full-Time",
              employerVerification.employer2.employmentType === "Full-Time"
            ),
            createCheckboxField(
              "Part-Time",
              employerVerification.employer2.employmentType === "Part-Time"
            ),
            createCheckboxField(
              "Casual",
              employerVerification.employer2.employmentType === "Casual"
            ),

            createParagraph("3. Description of Duties", { bold: true }),
            createParagraph(
              "Please provide a detailed description of the student's duties and responsibilities; include any additional comments:"
            ),
            createTextBox(employerVerification.employer2.duties || "", {
              height: 200,
            }),

            createParagraph("4. Alignment with Competencies", { bold: true }),
            createParagraph(
              "Please confirm which of the following competencies the student demonstrated during their employment. Refer to the attached relevant referee testimonial and skills verification declaration."
            ),

            createParagraph("6. Employer Declaration", { bold: true }),
            createParagraph(
              `I, ${
                employerVerification.employer2.supervisorName ||
                "_______________________"
              } (Employer/Supervisor Name), confirm that the above information is accurate and true to the best of my knowledge.`
            ),

            createSignatureLine(
              "Signature",
              employerVerification.employer2.supervisorName || ""
            ),
            createFormField("Date: ", ""),

            // Page break
            new Paragraph({
              text: "",
              pageBreakBefore: true,
            }),

            // REFEREE TESTIMONIAL
            createTitle(
              "Referee Testimonial and Skills Verification Declaration (CPC31420 Certificate III in Construction Waterproofing)"
            ),
            createParagraph(
              `Verification of Skills for ${
                refereeTestimonial.studentName || "_______________________"
              } in CPC31420 Certificate III in Construction Waterproofing.`
            ),

            createParagraph(
              `This document serves as an official testimonial certifying that the above-named individual, ${
                refereeTestimonial.studentName || "_______________________"
              }, has demonstrated the competencies and practical skills required for CPC31420 Certificate III in Construction Waterproofing as outlined below. These skills were performed and verified during their employment at ${
                refereeTestimonial.companyName || "_______________________"
              } over a period of ${
                refereeTestimonial.employmentPeriod || "_______________________"
              }.`
            ),

            createParagraph(
              "The following list includes workplace activities regularly performed by the candidate as part of their role, aligned with the industry standards and requirements of the CPC31420 Certificate III in Construction Waterproofing. As a referee, I certify that I have directly observed or supervised the candidate in these tasks and can confirm their competency in each area."
            ),

            createParagraph(
              "Core Competencies and Activities Performed by the Candidate:",
              { bold: true }
            ),

            // Map through competencies with check marks for referee testimonial
            ...competenciesList.map((competency) =>
              createCheckboxField(
                competency,
                (refereeTestimonial.competencies &&
                  refereeTestimonial.competencies[competency]) ||
                  false
              )
            ),

            // Declaration section
            createParagraph(
              "In my capacity as Referee, I declare that the information provided in this document is true and accurate to the best of my knowledge. Should further verification or clarification be required, I can provide additional details."
            ),

            createParagraph("Referee Contact Details:", { bold: true }),

            createFormField("Name:", refereeTestimonial.refereeName || ""),
            createFormField(
              "• Qualification/Licence Details:",
              refereeTestimonial.qualification || ""
            ),
            createFormField("Position:", refereeTestimonial.position || ""),
            createFormField(
              "Organisation:",
              refereeTestimonial.organisation || ""
            ),
            createFormField(
              "Phone Number:",
              refereeTestimonial.phoneNumber || ""
            ),
            createFormField(
              "Email Address:",
              refereeTestimonial.emailAddress || ""
            ),

            createSignatureLine(
              "Signature",
              refereeTestimonial.signature || ""
            ),
            createFormField(
              "Referee Name:",
              refereeTestimonial.refereeName || ""
            ),
            createFormField("Date:", refereeTestimonial.date || ""),
          ],
        },
      ],
    });

    // Generate the document
    const buffer = await Packer.toBuffer(doc);

    // Write to file
    fs.writeFileSync(tempFilePath, buffer);

    // Upload the file to Firebase Storage
    const storageFilePath = `rpl_forms/${userId}/${applicationId}_rpl_form.docx`;
    await bucket.upload(tempFilePath, {
      destination: storageFilePath,
      metadata: {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });

    // Get the download URL
    const [url] = await bucket.file(storageFilePath).getSignedUrl({
      action: "read",
      expires: "03-01-2500", // Long expiration for demonstration purposes
    });

    // Clean up the temporary file
    fs.unlinkSync(tempFilePath);

    // Update the application record in Firestore with the form URL
    await db.collection("applications").doc(applicationId).update({
      rplIntakeFormUrl: url,
      rplIntakeFormPath: storageFilePath,
      rplIntakeFormGeneratedAt: new Date().toISOString(),
    });

    // Return the file URL
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
