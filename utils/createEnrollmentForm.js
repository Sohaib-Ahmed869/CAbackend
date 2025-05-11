// utils/generateEnrollmentPdf.js
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
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  Footer,
  Header,
  LineRuleType,
  Tab,
  TabStopPosition,
  TabStopType,
  HorizontalPositionRelativeFrom,
  HorizontalPositionAlign,
  VerticalPositionRelativeFrom,
  VerticalPositionAlign,
  PageNumber,
} = require("docx");

/**
 * Generate an enrollment form DOCX document based on form data
 * @param {Object} formData - The form data to fill in the document
 * @param {string} applicationId - The application ID
 * @param {string} userId - The user ID
 * @param {Object} db - Firestore database reference
 * @param {Object} bucket - Firebase storage bucket reference
 * @returns {Promise<Object>} - Promise resolving to an object with file URL
 */
const generateEnrollmentPdf = async (
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
      `enrollment_form_${applicationId}.docx`
    );

    // Helper function to create a title paragraph
    const createCheckboxString = (value, isChecked) => {
      return isChecked ? "☑" : "☐";
    };
    const createTitle = (text, level = HeadingLevel.HEADING_1) => {
      return new Paragraph({
        text: text,
        heading: level,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        },
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

    // Helper function to create a checkbox and label
    const createCheckbox = (text, isChecked = false, options = {}) => {
      const defaultOptions = {
        indent: { left: 0 },
        spacing: { before: 80, after: 80 },
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
              font: "Brush Script MT",
              size: 40,
              color: "000000",
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

    // Helper function to create a table with header and rows
    const createTable = (headers, rows) => {
      const table = new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE,
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          insideHorizontal: {
            style: BorderStyle.SINGLE,
            size: 1,
            color: "000000",
          },
          insideVertical: {
            style: BorderStyle.SINGLE,
            size: 1,
            color: "000000",
          },
        },
        rows: [
          new TableRow({
            children: headers.map(
              (header) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      text: header,
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 50, after: 50 },
                    }),
                  ],
                  shading: {
                    fill: "EEEEEE",
                  },
                })
            ),
          }),
          ...rows.map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: cell,
                          spacing: { before: 50, after: 50 },
                        }),
                      ],
                    })
                ),
              })
          ),
        ],
      });

      return table;
    };

    // Create a header with image and text
    // const createHeader = () => {
    //   return new Header({
    //     children: [
    //       new Paragraph({
    //         text: "Enrollment Form",
    //         heading: HeadingLevel.HEADING_1,
    //         alignment: AlignmentType.CENTER,
    //         spacing: { before: 100, after: 100 },
    //       }),
    //       new Paragraph({
    //         text: "All printed copies of this Document are considered 'Uncontrolled Copies'. Printed copies are only valid for the day printed.",
    //         alignment: AlignmentType.CENTER,
    //         spacing: { before: 100, after: 100 },
    //         style: "smallText",
    //       }),
    //     ],
    //   });
    // };
    const createHeader = () => {
      try {
        // Check if logo file exists
        const logoPath = "./utils/logo.png";
        if (fs.existsSync(logoPath)) {
          return new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Enrollment Form",
                    bold: true,
                    wrap: false,
                    size: 28, // Size in half-points (28 = 14pt)
                  }),
                  new ImageRun({
                    data: fs.readFileSync(logoPath),
                    transformation: {
                      width: 100, // Width in pixels
                      height: 50, // Height in pixels
                    },
                    floating: {
                      horizontalPosition: {
                        relative: HorizontalPositionRelativeFrom.PAGE,
                        align: HorizontalPositionAlign.RIGHT,
                      },
                      verticalPosition: {
                        relative: VerticalPositionRelativeFrom.PAGE,
                        align: VerticalPositionAlign.TOP,
                      },
                      wrap: {
                        type: "square",
                        side: "both",
                      },
                    },
                  }),
                ],
                spacing: { before: 100, after: 100 },
              }),
              new Paragraph({
                text: "All printed copies of this Document are considered 'Uncontrolled Copies'. Printed copies are only valid for the day printed.",
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 100 },
                style: "smallText",
              }),
            ],
          });
        } else {
          // Fallback if logo doesn't exist
          return new Header({
            children: [
              new Paragraph({
                text: "Enrollment Form",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 100 },
              }),
              new Paragraph({
                text: "All printed copies of this Document are considered 'Uncontrolled Copies'. Printed copies are only valid for the day printed.",
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 100 },
                style: "smallText",
              }),
            ],
          });
        }
      } catch (error) {
        console.error("Error creating header with logo:", error);
        // Fallback to original header without logo
        return new Header({
          children: [
            new Paragraph({
              text: "Enrollment Form",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
            }),
            new Paragraph({
              text: "All printed copies of this Document are considered 'Uncontrolled Copies'. Printed copies are only valid for the day printed.",
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              style: "smallText",
            }),
          ],
        });
      }
    };
    // Create a footer with page numbers
    // const createFooter = () => {
    //   return new Footer({
    //     children: [
    //       new Paragraph({
    //         alignment: AlignmentType.CENTER,
    //         children: [
    //           new TextRun("Page "),
    //           new TextRun({
    //             children: ["PAGE", " of ", "NUMPAGES"],
    //           }),
    //         ],
    //       }),
    //     ],
    //   });
    // };
    // Correct implementation for page numbering in docx.js
    const createFooter = () => {
      return new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun("Page "),
              new TextRun({
                children: [PageNumber.CURRENT],
              }),
              new TextRun(" of "),
              new TextRun({
                children: [PageNumber.TOTAL_PAGES],
              }),
            ],
          }),
        ],
      });
    };

    // Helper function to create instruction text
    const createInstructionText = (text) => {
      return new Paragraph({
        children: [
          new TextRun({
            text: text,
            italics: true,
            size: 20,
          }),
        ],
        spacing: { before: 100, after: 100 },
      });
    };

    // Helper function to create a section break
    const createSectionBreak = () => {
      return new Paragraph({
        text: "",
        pageBreakBefore: true,
      });
    };

    // Extract relevant data from formData
    const personalDetails = formData.personalDetails || {};
    const contactDetails = formData.contactDetails || {};
    const emergencyContact = formData.emergencyContact || {};
    const residentialAddress = formData.residentialAddress || {};
    const postalAddress = formData.postalAddress || {};
    const employmentDetails = formData.employmentDetails || {};
    const culturalDiversity = formData.culturalDiversity || {};
    const usiDetails = formData.usiDetails || {};
    const educationDetails = formData.educationDetails || {};
    const employmentStatus = formData.employmentStatus || {};
    const disability = formData.disability || {};
    const qualifications = formData.qualifications || {};
    const studyReason = formData.studyReason || {};
    const citizenship = formData.citizenship || {};
    const courseSelection = formData.courseSelection || {};
    const preTrainingChecklist = formData.preTrainingChecklist || {};
    const declarations = formData.declarations || {};
    const preTrainingInterview = formData.preTrainingInterview || {};
    const llnAssessment = formData.llnAssessment || {};
    const additionalSupport = preTrainingInterview?.additionalSupport || [];
    const preTrainingItems = preTrainingChecklist.items || {};
    const learningStyles = preTrainingInterview?.learningStyles || [];

    // Create document sections/content
    const doc = new Document({
      title: "Enrollment Form",
      description: "Student Enrollment Form",
      styles: {
        paragraphStyles: [
          {
            id: "smallText",
            name: "Small Text",
            basedOn: "Normal",
            next: "Normal",
            run: {
              size: 16,
            },
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1000,
                right: 1000,
                bottom: 1000,
                left: 1000,
              },
            },
          },
          headers: {
            default: createHeader(),
          },
          footers: {
            default: createFooter(),
          },
          children: [
            // INTRODUCTION
            createInstructionText(
              "Please use BLOCK LETTERS when filling out this form and ensure that all sections are completed and appropriate tick boxes marked as applicable. Information collected on this enrolment form is confidential and will not affect you as an individual in your studies."
            ),

            // SECTION 1 - PERSONAL DETAILS
            createHeading(
              "1. Personal Details (including full legal name)",
              HeadingLevel.HEADING_2
            ),

            createFormField(
              "Title (Mr, Miss, Ms, Mrs, Other): ",
              personalDetails.title || ""
            ),

            // Gender checkboxes
            new Paragraph({
              children: [
                new TextRun({ text: "Gender: ", bold: true }),
                new TextRun({ text: "☐ Male    " }),
                new TextRun({ text: "☐ Female    " }),
                new TextRun({ text: "☐ Other" }),
              ],
              spacing: { before: 100, after: 100 },
            }),

            createFormField(
              "Family name (Surname): ",
              personalDetails.familyName || ""
            ),
            createFormField("First Name: ", personalDetails.firstName || ""),
            createFormField(
              "Middle Name(s): ",
              personalDetails.middleNames || ""
            ),
            createFormField(
              "Preferred Name: ",
              personalDetails.preferredName || ""
            ),
            createFormField("Date of Birth: ", personalDetails.dob || ""),

            // SECTION 2 - CONTACT DETAILS
            createHeading("2. Your Contact Details", HeadingLevel.HEADING_2),

            createFormField("Home Phone: ", contactDetails.homePhone || ""),
            createFormField("Mobile Phone: ", contactDetails.mobilePhone || ""),
            createFormField("Email Address: ", contactDetails.email || ""),
            createFormField("Work Phone: ", contactDetails.workPhone || ""),
            createFormField(
              "Alternative email address (optional): ",
              contactDetails.altEmail || ""
            ),

            // Preferred contact method checkboxes
            new Paragraph({
              children: [
                new TextRun({ text: "Preferred Contact Method: ", bold: true }),
                new TextRun({ text: "☐ via Mobile Phone    " }),
                new TextRun({ text: "☐ via Email    " }),
                new TextRun({ text: "☐ via Post" }),
              ],
              spacing: { before: 100, after: 100 },
            }),

            // SECTION 3 - EMERGENCY CONTACT
            createHeading("3. Your Emergency Contact", HeadingLevel.HEADING_2),

            createFormField("Name: ", emergencyContact.name || ""),
            createFormField(
              "Relationship: ",
              emergencyContact.relationship || ""
            ),
            createFormField("Home Phone: ", emergencyContact.homePhone || ""),
            createFormField(
              "Mobile Phone: ",
              emergencyContact.mobilePhone || ""
            ),
            createFormField("Work Phone: ", emergencyContact.workPhone || ""),

            // SECTION 4 - RESIDENTIAL ADDRESS
            createHeading(
              "4. What is the address of your usual residence?",
              HeadingLevel.HEADING_2
            ),

            createInstructionText(
              "Please provide the physical address (street number and name not post office box) where you usually reside rather than any temporary address at which you reside for training, work or other purposes before returning to your home. If you are from a rural area use the address from your state or territory's 'rural property addressing' or 'numbering' system as your residential street address. Building/property name is the official place name or common usage name for an address site, including the name of a building, Aboriginal community, homestead, building complex, agricultural property, park or unbounded address site."
            ),

            createFormField(
              "Building/property name: ",
              residentialAddress.buildingName || ""
            ),
            createFormField(
              "Flat/unit details: ",
              residentialAddress.flatDetails || ""
            ),
            createFormField(
              "Street or lot number (e.g. 205 or Lot 118): ",
              residentialAddress.streetNumber || ""
            ),
            createFormField(
              "Street name: ",
              residentialAddress.streetName || ""
            ),
            createFormField(
              "Suburb, locality or town: ",
              residentialAddress.suburb || ""
            ),
            createFormField(
              "State/territory: ",
              residentialAddress.state || ""
            ),
            createFormField("Postcode: ", residentialAddress.postcode || ""),

            // PAGE BREAK
            createSectionBreak(),

            // SECTION 5 - POSTAL ADDRESS
            createHeading(
              "5. What is your postal address (if different from above)?",
              HeadingLevel.HEADING_2
            ),

            createFormField(
              "Building/property name: ",
              postalAddress.buildingName || ""
            ),
            createFormField(
              "Flat/unit details: ",
              postalAddress.flatDetails || ""
            ),
            createFormField(
              "Street or lot number (e.g. 205 or Lot 118): ",
              postalAddress.streetNumber || ""
            ),
            createFormField("Street name: ", postalAddress.streetName || ""),
            createFormField(
              "Postal delivery information (e.g. PO Box 254): ",
              postalAddress.postalDelivery || ""
            ),
            createFormField(
              "Suburb, locality or town: ",
              postalAddress.suburb || ""
            ),
            createFormField("State/territory: ", postalAddress.state || ""),
            createFormField("Postcode: ", postalAddress.postcode || ""),

            // SECTION 6 - WORKPLACE EMPLOYER DETAILS
            createHeading(
              "6. WORKPLACE EMPLOYER DETAILS (if applicable)",
              HeadingLevel.HEADING_2
            ),

            createFormField(
              "Trading Name: ",
              employmentDetails.tradingName || ""
            ),
            createFormField(
              "Contact Name: ",
              employmentDetails.contactName || ""
            ),
            createFormField(
              "Supervisor Name: ",
              employmentDetails.supervisorName || ""
            ),
            createFormField(
              "Training Address: ",
              employmentDetails.trainingAddress || ""
            ),
            createFormField("Phone: ", employmentDetails.phone || ""),
            createFormField(
              "Employer email: ",
              employmentDetails.employeeEmail || ""
            ),

            // SECTION 7 - LANGUAGE AND CULTURAL DIVERSITY
            createHeading(
              "7. Language and Cultural Diversity",
              HeadingLevel.HEADING_2
            ),

            // Indigenous status checkboxes
            new Paragraph({
              children: [
                new TextRun({
                  text: "Are you of Aboriginal/Torres Strait Islander origin? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createCheckbox("No", culturalDiversity.indigenousStatus === "No"),
            createCheckbox(
              "Yes, Torres Strait Islander",
              culturalDiversity.indigenousStatus ===
                "Yes, Torres Strait Islander"
            ),
            createCheckbox(
              "Yes, Aboriginal",
              culturalDiversity.indigenousStatus === "Yes, Aboriginal"
            ),
            createCheckbox(
              "Yes, Aboriginal & T.S. Islander",
              culturalDiversity.indigenousStatus ===
                "Yes, Aboriginal & T.S. Islander"
            ),

            // Country of birth
            new Paragraph({
              children: [
                new TextRun({
                  text: "In which country were you born? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createCheckbox(
              "Australia",
              culturalDiversity.countryOfBirth === "Australia"
            ),
            createCheckbox(
              "Other",
              culturalDiversity.countryOfBirth === "Other"
            ),
            createFormField(
              "If other, please specify: ",
              culturalDiversity.otherCountry || ""
            ),

            // Language other than English
            new Paragraph({
              children: [
                new TextRun({
                  text: "Do you speak a language other than English at home? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createCheckbox(
              "No (English only)",
              culturalDiversity.otherLanguage === "No"
            ),
            createCheckbox("Yes", culturalDiversity.otherLanguage === "Yes"),
            createFormField(
              "If yes, please specify: ",
              culturalDiversity.specifyLanguage || ""
            ),

            // English proficiency
            new Paragraph({
              children: [
                new TextRun({
                  text: "If you speak a language other than English at home, how well do you speak English? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createCheckbox(
              "Very Well",
              culturalDiversity.englishProficiency === "Very Well"
            ),
            createCheckbox(
              "Well",
              culturalDiversity.englishProficiency === "Well"
            ),
            createCheckbox(
              "Not well",
              culturalDiversity.englishProficiency === "Not well"
            ),
            createCheckbox(
              "Not at all",
              culturalDiversity.englishProficiency === "Not at all"
            ),

            // PAGE BREAK
            createSectionBreak(),

            // SECTION 8 - UNIQUE STUDENT IDENTIFIER (USI)
            createHeading(
              "8. Unique Student Identifier (USI)",
              HeadingLevel.HEADING_2
            ),

            createParagraph(
              "From 1 January 2015, we Alpha Training & Recognition can be prevented from issuing you with a nationally recognised VET qualification or statement of attainment when you complete your course if you do not have a Unique Student Identifier (USI). In addition, we are required to include your USI in the data we submit to NCVER. If you have not yet obtained a USI you can apply for it directly at http://www.usi.gov.au/create-your-USI/ on computer or mobile device. Please note that if you would like to specify your gender as 'other' you will need to contact the USI Office for assistance."
            ),

            createFormField("Enter your USI: ", usiDetails.usiNumber || ""),

            createParagraph(
              "If you want that RTO will create a USI on your behalf, then go to point 9 and complete the information."
            ),

            // SECTION 9 - USI APPLICATION THROUGH RTO
            createHeading(
              "9. USI application through your RTO (if you do not already have one)",
              HeadingLevel.HEADING_2
            ),

            createParagraph("Application for Unique Student Identifier (USI)"),

            createParagraph(
              "If you would like us [Alpha Training & Recognition] to apply for a USI on your behalf you must authorise us to do so and declare that you have read the privacy information at <https://www.usi.gov.au/documents/privacy-notice-when-rto-applies-their-behalf>. You must also provide some additional information as noted at the end of this form so that we can apply for a USI on your behalf."
            ),

            createFormField(
              "I [NAME] ",
              usiDetails.createUSI
                ? personalDetails.firstName + " " + personalDetails.familyName
                : ""
            ),
            createParagraph(
              "authorise Alpha Training & Recognition to apply pursuant to sub-section 9(2) of the Student Identifiers Act 2014, for a USI on my behalf."
            ),

            createParagraph(
              "I have read and I consent to the collection, use and disclosure of my personal information (which may include sensitive information) pursuant to the information detailed at <https://www.usi.gov.au/documents/privacy-notice-when-rto-applies-their-behalf>."
            ),

            createFormField("Town/City of Birth: ", usiDetails.birthCity || ""),
            createParagraph(
              "(please write the name of the Australian or overseas town or city where you were born)"
            ),

            createParagraph(
              "We will also need to verify your identity to create your USI."
            ),
            createParagraph(
              "Please provide details for one of the forms of identity below (numbered 1 to 8)."
            ),
            createParagraph(
              "Please ensure that the name written in 'Personal Details' section is exactly the same as written in the document you provide below."
            ),

            // Identity document options
            new Paragraph({
              children: [
                new TextRun({ text: "Identity document type: ", bold: true }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createCheckbox(
              "1. Australian Driver's Licence",
              usiDetails.identityType === "ausDriversLicence"
            ),
            createCheckbox(
              "2. Medicare Card",
              usiDetails.identityType === "medicareCard"
            ),
            createCheckbox(
              "3. Immicard",
              usiDetails.identityType === "immicard"
            ),
            createCheckbox(
              "4. Certificate of Registration by Descent",
              usiDetails.identityType === "certRegDescent"
            ),
            createCheckbox(
              "5. Australian Birth Certificate",
              usiDetails.identityType === "ausBirthCert"
            ),
            createCheckbox(
              "6. Non-Australian Passport (with Australian Visa)",
              usiDetails.identityType === "nonAusPassport"
            ),
            createCheckbox(
              "7. Australian Passport",
              usiDetails.identityType === "ausPassport"
            ),
            createCheckbox(
              "8. Citizenship Certificate",
              usiDetails.identityType === "citizenshipCert"
            ),

            createParagraph(
              "In accordance with section 11 of the Student Identifiers Act 2014, Alpha Training & Recognition will securely destroy personal information which we collect from individuals solely for the purpose of applying for a USI on their behalf as soon as practicable after we have made the application or the information is no longer needed for that purpose."
            ),

            // PAGE BREAK
            createSectionBreak(),

            // SECTION 10 - EDUCATION DETAILS
            createHeading("10. Education Details", HeadingLevel.HEADING_2),

            // Currently enrolled in school
            new Paragraph({
              children: [
                new TextRun({
                  text: "Are you still enrolled in secondary or senior secondary education? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createCheckbox("No", educationDetails.enrolledInSchool === "No"),
            createCheckbox("Yes", educationDetails.enrolledInSchool === "Yes"),

            // Highest completed school level
            new Paragraph({
              children: [
                new TextRun({
                  text: "What is your highest COMPLETED school level? (Not inclusive of higher education) ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createParagraph("Tick one box only"),
            createCheckbox(
              "Completed Year 12",
              educationDetails.highestSchoolLevel === "Completed Year 12"
            ),
            createCheckbox(
              "Completed Year 11",
              educationDetails.highestSchoolLevel === "Completed Year 11"
            ),
            createCheckbox(
              "Completed Year 10",
              educationDetails.highestSchoolLevel === "Completed Year 10"
            ),
            createCheckbox(
              "Completed Yr. 9 or equivalent",
              educationDetails.highestSchoolLevel ===
                "Completed Yr. 9 or equivalent"
            ),
            createCheckbox(
              "Completed Yr. 8 or lower",
              educationDetails.highestSchoolLevel === "Completed Yr. 8 or lower"
            ),
            createCheckbox(
              "Never attended school",
              educationDetails.highestSchoolLevel === "Never attended school"
            ),

            createFormField(
              "In which year did you complete this school level? ",
              educationDetails.completionYear || ""
            ),
            createFormField(
              "If still attending school, name of school: ",
              educationDetails.currentSchool || ""
            ),
            createFormField(
              "Previous secondary school (if applicable): ",
              educationDetails.previousSchool || ""
            ),

            // SECTION 11 - EMPLOYMENT STATUS
            createHeading("11. Employment Status", HeadingLevel.HEADING_2),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Which of the following categories BEST describes your current employment status? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createParagraph("Tick one box only"),
            createCheckbox(
              "Employed – unpaid worker in a family business",
              employmentStatus.currentStatus ===
                "Employed – unpaid worker in a family business"
            ),
            createCheckbox(
              "Self-employed – not employing others",
              employmentStatus.currentStatus ===
                "Self-employed – not employing others"
            ),
            createCheckbox(
              "Not employed – not seeking employment",
              employmentStatus.currentStatus ===
                "Not employed – not seeking employment"
            ),
            createCheckbox(
              "Unemployed – seeking full time work",
              employmentStatus.currentStatus ===
                "Unemployed – seeking full time work"
            ),
            createCheckbox(
              "Unemployed – seeking part time work",
              employmentStatus.currentStatus ===
                "Unemployed – seeking part time work"
            ),
            createCheckbox(
              "Full time employee",
              employmentStatus.currentStatus === "Full time employee"
            ),
            createCheckbox(
              "Part time employee",
              employmentStatus.currentStatus === "Part time employee"
            ),
            createCheckbox(
              "Employer",
              employmentStatus.currentStatus === "Employer"
            ),

            createFormField("Where are you employed? ", ""), // This field isn't in the provided formData

            // Employee count
            new Paragraph({
              children: [
                new TextRun({
                  text: "How many employees are at your current employer? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createCheckbox(
              "Up to 20",
              employmentStatus.employeeCount === "Up to 20"
            ),
            createCheckbox(
              "Over 20",
              employmentStatus.employeeCount === "Over 20"
            ),

            // SECTION 12-13 were skipped in the original form

            // PAGE BREAK
            createSectionBreak(),

            // SECTION 14 - DISABILITY
            createHeading("14. Disability", HeadingLevel.HEADING_2),

            // Has disability
            new Paragraph({
              children: [
                new TextRun({
                  text: "Do you consider yourself to have a disability, impairment or long term condition? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createCheckbox("YES", disability.hasDisability === "YES"),
            createCheckbox("NO", disability.hasDisability === "NO"),

            // Disability types
            new Paragraph({
              children: [
                new TextRun({
                  text: "If yes, please indicate the areas of disability, impairment or long term condition. You may indicate more than one. ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createCheckbox(
              "Hearing/deaf",
              disability.disabilityTypes &&
                disability.disabilityTypes.includes("Hearing/deaf")
            ),
            createCheckbox(
              "Physical",
              disability.disabilityTypes &&
                disability.disabilityTypes.includes("Physical")
            ),
            createCheckbox(
              "Intellectual",
              disability.disabilityTypes &&
                disability.disabilityTypes.includes("Intellectual")
            ),
            createCheckbox(
              "Learning",
              disability.disabilityTypes &&
                disability.disabilityTypes.includes("Learning")
            ),
            createCheckbox(
              "Mental illness",
              disability.disabilityTypes &&
                disability.disabilityTypes.includes("Mental illness")
            ),
            createCheckbox(
              "Acquired brain impairment",
              disability.disabilityTypes &&
                disability.disabilityTypes.includes("Acquired brain impairment")
            ),
            createCheckbox(
              "Vision",
              disability.disabilityTypes &&
                disability.disabilityTypes.includes("Vision")
            ),
            createCheckbox(
              "Medical condition",
              disability.disabilityTypes &&
                disability.disabilityTypes.includes("Medical condition")
            ),
            createCheckbox(
              "Other",
              disability.disabilityTypes &&
                disability.disabilityTypes.includes("Other")
            ),

            createFormField(
              "Please specify other: ",
              disability.otherDisability || ""
            ),

            // SECTION 15 - PREVIOUS QUALIFICATIONS
            createHeading(
              "15. Previous Qualifications/Education",
              HeadingLevel.HEADING_2
            ),

            // Completed qualifications
            new Paragraph({
              children: [
                new TextRun({
                  text: "Have you successfully COMPLETED any of the following qualifications? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createCheckbox(
              "Yes",
              qualifications.completedQualifications === "Yes"
            ),
            createCheckbox(
              "No",
              qualifications.completedQualifications === "No"
            ),

            // If yes, specify which qualifications
            new Paragraph({
              children: [
                new TextRun({
                  text: "If yes, please tick ONE applicable box relating to your prior education at ANY applicable Level as follows: ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            new Paragraph({
              children: [
                new TextRun({ text: "A = Australian Qualification" }),
                new TextRun({ text: "\n" }),
                new TextRun({ text: "E = Australian Equivalent*" }),
                new TextRun({ text: "\n" }),
                new TextRun({ text: "I = International" }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            // Combined qualifications table - using a single table with two sections
            new Table({
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                insideVertical: { style: BorderStyle.SINGLE, size: 1 },
              },
              rows: [
                // Header row
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: "A E I" })],
                      width: { size: 15, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "" })],
                      width: { size: 35, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "A E I" })],
                      width: { size: 15, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "" })],
                      width: { size: 35, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
                // Row 1
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          text:
                            createCheckboxString(
                              "A",
                              qualifications.bachelorDegree === "A"
                            ) +
                            " " +
                            createCheckboxString(
                              "E",
                              qualifications.bachelorDegree === "E"
                            ) +
                            " " +
                            createCheckboxString(
                              "I",
                              qualifications.bachelorDegree === "I"
                            ),
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "Bachelor Degree or Higher Degree",
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text:
                            createCheckboxString(
                              "A",
                              qualifications.certificateIII === "A"
                            ) +
                            " " +
                            createCheckboxString(
                              "E",
                              qualifications.certificateIII === "E"
                            ) +
                            " " +
                            createCheckboxString(
                              "I",
                              qualifications.certificateIII === "I"
                            ),
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "Certificate III or Trade Certificate",
                        }),
                      ],
                    }),
                  ],
                }),
                // Row 2
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          text:
                            createCheckboxString(
                              "A",
                              qualifications.advancedDiploma === "A"
                            ) +
                            " " +
                            createCheckboxString(
                              "E",
                              qualifications.advancedDiploma === "E"
                            ) +
                            " " +
                            createCheckboxString(
                              "I",
                              qualifications.advancedDiploma === "I"
                            ),
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "Advanced Diploma or Associate Degree",
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text:
                            createCheckboxString(
                              "A",
                              qualifications.certificateII === "A"
                            ) +
                            " " +
                            createCheckboxString(
                              "E",
                              qualifications.certificateII === "E"
                            ) +
                            " " +
                            createCheckboxString(
                              "I",
                              qualifications.certificateII === "I"
                            ),
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "Certificate II",
                        }),
                      ],
                    }),
                  ],
                }),
                // Row 3
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          text:
                            createCheckboxString(
                              "A",
                              qualifications.diploma === "A"
                            ) +
                            " " +
                            createCheckboxString(
                              "E",
                              qualifications.diploma === "E"
                            ) +
                            " " +
                            createCheckboxString(
                              "I",
                              qualifications.diploma === "I"
                            ),
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "Diploma or Associate Diploma",
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text:
                            createCheckboxString(
                              "A",
                              qualifications.certificateI === "A"
                            ) +
                            " " +
                            createCheckboxString(
                              "E",
                              qualifications.certificateI === "E"
                            ) +
                            " " +
                            createCheckboxString(
                              "I",
                              qualifications.certificateI === "I"
                            ),
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "Certificate I",
                        }),
                      ],
                    }),
                  ],
                }),
                // Row 4
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          text:
                            createCheckboxString(
                              "A",
                              qualifications.certificateIV === "A"
                            ) +
                            " " +
                            createCheckboxString(
                              "E",
                              qualifications.certificateIV === "E"
                            ) +
                            " " +
                            createCheckboxString(
                              "I",
                              qualifications.certificateIV === "I"
                            ),
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "Certificate IV or Advanced Cert/Technician",
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text:
                            createCheckboxString(
                              "A",
                              qualifications.other === "A"
                            ) +
                            " " +
                            createCheckboxString(
                              "E",
                              qualifications.other === "E"
                            ) +
                            " " +
                            createCheckboxString(
                              "I",
                              qualifications.other === "I"
                            ),
                        }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "Other (please specify)",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            createParagraph(
              "If multiple of one type, use above priority order (A), (E) and then (I)."
            ),
            createParagraph(
              "*To determine 'Australian Equivalent' qualifications, please refer to the Overseas Qualifications Unit (OQU)."
            ),

            // Helper function to create checkbox strings
            // function createCheckboxString(value, isChecked) {
            //   return isChecked ? "☑" : "☐";
            // }
            // SECTION 16 - STUDY REASON
            createHeading("16. Study Reason", HeadingLevel.HEADING_2),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Of the following reasons, which BEST describes your main reason for undertaking this course / traineeship / apprenticeship? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createParagraph("Tick one box only"),

            createCheckbox(
              "To get a job",
              studyReason.mainReason === "To get a job"
            ),
            createCheckbox(
              "To develop my existing business",
              studyReason.mainReason === "To develop my existing business"
            ),
            createCheckbox(
              "To start my own business",
              studyReason.mainReason === "To start my own business"
            ),
            createCheckbox(
              "To try for a different career",
              studyReason.mainReason === "To try for a different career"
            ),
            createCheckbox(
              "To get a better job or promotion",
              studyReason.mainReason === "To get a better job or promotion"
            ),
            createCheckbox(
              "It was a requirement of my job",
              studyReason.mainReason === "It was a requirement of my job"
            ),
            createCheckbox(
              "I wanted extra skills for my job",
              studyReason.mainReason === "I wanted extra skills for my job"
            ),
            createCheckbox(
              "To get into another course of study",
              studyReason.mainReason === "To get into another course of study"
            ),
            createCheckbox(
              "For personal interest or self-development",
              studyReason.mainReason ===
                "For personal interest or self-development"
            ),
            createCheckbox(
              "Other Reasons",
              studyReason.mainReason === "Other Reasons"
            ),

            // SECTION 17 - STUDENT CONTACT
            createHeading("17. Student Contact", HeadingLevel.HEADING_2),

            new Paragraph({
              children: [
                new TextRun({
                  text: "How did you find out about the course you are enrolling in? ",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),
            createParagraph("Tick one box only"),

            createCheckbox(
              "Job Services",
              studyReason.discoveryMethod === "Job Services"
            ),
            createCheckbox(
              "Staff Member",
              studyReason.discoveryMethod === "Staff Member"
            ),
            createCheckbox(
              "Current/Past Student",
              studyReason.discoveryMethod === "Current/Past Student"
            ),
            createCheckbox("Flyer", studyReason.discoveryMethod === "Flyer"),
            createCheckbox(
              "Website",
              studyReason.discoveryMethod === "Website"
            ),
            createCheckbox(
              "Radio advertising",
              studyReason.discoveryMethod === "Radio advertising"
            ),
            createCheckbox(
              "Word of mouth",
              studyReason.discoveryMethod === "Word of mouth"
            ),
            createCheckbox(
              "Social Media (e.g. Facebook)",
              studyReason.discoveryMethod === "Social Media (e.g. Facebook)"
            ),
            createCheckbox(
              "Apprentice Centre",
              studyReason.discoveryMethod === "Apprentice Centre"
            ),
            createCheckbox(
              "Newspapers",
              studyReason.discoveryMethod === "Newspapers"
            ),
            createCheckbox(
              "Workplace",
              studyReason.discoveryMethod === "Workplace"
            ),
            createCheckbox(
              "Other (please specify)",
              studyReason.discoveryMethod === "Other"
            ),

            // PAGE BREAK
            createSectionBreak(),

            // SECTION 18 - STUDENT HANDBOOK
            createHeading("18. Student Handbook", HeadingLevel.HEADING_2),

            createParagraph("The student handbook outlines the following:"),

            createParagraph(
              "o Student fee information\no Refund Policy\no Code of conduct\no Complaints procedure\no Appeals procedure\no Assessment guidelines\no Student welfare and support services\no Recognition of prior learning"
            ),

            createParagraph(
              "I declare that I have read and understood RTO student handbook and their policies & procedures regarding the above."
            ),

            createSignatureLine(
              "Signature",
              declarations.studentSignature || ""
            ),
            createFormField("Date: ", declarations.date || ""),

            createParagraph(
              "The Student Handbook can be found on RTO website. www.atr.edu.au"
            ),

            // SECTION 19 - AUSTRALIAN CITIZENSHIP STATUS
            createHeading(
              "19. Australian Citizenship Status",
              HeadingLevel.HEADING_2
            ),

            createCheckbox(
              "Australian Citizen",
              citizenship.status === "Australian Citizen"
            ),
            createCheckbox(
              "New Zealand Citizen",
              citizenship.status === "New Zealand Citizen"
            ),
            createCheckbox(
              "Permanent Resident",
              citizenship.status === "Permanent Resident"
            ),
            createCheckbox(
              "Other (please provide details)",
              citizenship.status === "Other"
            ),

            createFormField("Other details: ", citizenship.otherDetails || ""),

            // SECTION 20 - PROGRAM / QUALIFICATION
            createHeading(
              "20. Program / Qualification to be enrolled in. Select one of the following courses:",
              HeadingLevel.HEADING_2
            ),

            createCheckbox(
              "CPC30220 - Certificate III in Carpentry",
              courseSelection.selectedCourse ===
                "CPC30220 - Certificate III in Carpentry"
            ),
            createCheckbox(
              "CPC30620 - Certificate III in Painting and Decorating",
              courseSelection.selectedCourse ===
                "CPC30620 - Certificate III in Painting and Decorating"
            ),
            createCheckbox(
              "CPC40120 - Certificate IV in Building and Construction",
              courseSelection.selectedCourse ===
                "CPC40120 - Certificate IV in Building and Construction"
            ),
            createCheckbox(
              "CPC50210 - Diploma of Building and Construction (Building)",
              courseSelection.selectedCourse ===
                "CPC50210 - Diploma of Building and Construction (Building)"
            ),
            createCheckbox(
              "CPC50220 - Diploma of Building and Construction (Building)",
              courseSelection.selectedCourse ===
                "CPC50220 - Diploma of Building and Construction (Building)"
            ),
            createCheckbox(
              "AHC30921 - Certificate III in Landscape Construction",
              courseSelection.selectedCourse ===
                "AHC30921 - Certificate III in Landscape Construction"
            ),
            createCheckbox(
              "CPC30420 - Certificate III in Demolition",
              courseSelection.selectedCourse ===
                "CPC30420 - Certificate III in Demolition"
            ),
            createCheckbox(
              "CPC30820 - Certificate III in Roof Tiling",
              courseSelection.selectedCourse ===
                "CPC30820 - Certificate III in Roof Tiling"
            ),
            createCheckbox(
              "CPC31020 - Certificate III in Solid Plastering",
              courseSelection.selectedCourse ===
                "CPC31020 - Certificate III in Solid Plastering"
            ),
            createCheckbox(
              "CPC32420 - Certificate III in Plumbing",
              courseSelection.selectedCourse ===
                "CPC32420 - Certificate III in Plumbing"
            ),
            createCheckbox(
              "CPC32620 - Certificate III in Roof Plumbing",
              courseSelection.selectedCourse ===
                "CPC32620 - Certificate III in Roof Plumbing"
            ),
            createCheckbox(
              "CPC40920 - Certificate IV in Plumbing and Services",
              courseSelection.selectedCourse ===
                "CPC40920 - Certificate IV in Plumbing and Services"
            ),
            createCheckbox(
              "CPC41020 - Certificate IV in Demolition",
              courseSelection.selectedCourse ===
                "CPC41020 - Certificate IV in Demolition"
            ),
            createCheckbox(
              "MSF30322 - Certificate III in Cabinet Making and Timber Technology",
              courseSelection.selectedCourse ===
                "MSF30322 - Certificate III in Cabinet Making and Timber Technology"
            ),

            // SECTION 21 - PRE-TRAINING CHECKLIST
            createHeading(
              "21. Pre-Training Checklist (Please tick the correct boxes)",
              HeadingLevel.HEADING_2
            ),

            // Check if preTrainingChecklist.items exists and has the specified properties

            createCheckbox(
              "Pre-training form completed",
              preTrainingItems.preTrainingForm
            ),
            createCheckbox(
              "Entry Requirements discussed",
              preTrainingItems.entryRequirements
            ),
            createCheckbox(
              "Language, Literacy and Numeracy (LLN) assessment completed by student and attached",
              preTrainingItems.llnCompleted
            ),
            createCheckbox(
              "Credit Transfer discussed",
              preTrainingItems.creditTransfer
            ),
            createCheckbox(
              "Delivery Mode discussed",
              preTrainingItems.deliveryMode
            ),
            createCheckbox(
              "Location of the course discussed",
              preTrainingItems.locationDiscussed
            ),
            createCheckbox(
              "Recognition of prior learning(RPL) discussed",
              preTrainingItems.rplDiscussed
            ),
            createCheckbox(
              "Tuition fees, Concession and Exemption discussed",
              preTrainingItems.feesDiscussed
            ),
            createCheckbox(
              "Refund policy discussed",
              preTrainingItems.refundPolicy
            ),
            createCheckbox(
              "Student question answered",
              preTrainingItems.questionsAnswered
            ),
            createCheckbox(
              "I have read and understand the student handbook",
              preTrainingItems.handbookRead
            ),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Please indicate any special needs, assistance you may require during the course (e.g Writing assistance)",
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createTextBox(preTrainingItems.specialNeeds || ""),

            // PAGE BREAK
            createSectionBreak(),

            // PRIVACY STATEMENT & STUDENT DECLARATION
            createTitle(
              "Privacy Statement & Student Declaration",
              HeadingLevel.HEADING_2
            ),

            createHeading("Privacy Notice", HeadingLevel.HEADING_3),

            createParagraph(
              "Under the Data Provision Requirements 2012, Alpha Training & Recognition is required to collect personal information about you and to disclose that personal information to the National Centre for Vocational Education Research Ltd (NCVER)."
            ),

            createParagraph(
              "Your personal information (including the personal information contained on this enrolment form and your training activity data) may be used or disclosed by Alpha Training & Recognition for statistical, regulatory and research purposes. Alpha Training & Recognition may disclose your personal information for these purposes to third parties, including:"
            ),

            createParagraph(
              "• School – if you are a secondary student undertaking VET, including a school-based apprenticeship or traineeship;\n• Employer – if you are enrolled in training paid by your employer;\n• Commonwealth and State or Territory government departments and authorised agencies;\n• NCVER;\n• Organisations conducting student surveys; and\n• Researchers."
            ),

            createParagraph(
              "Personal information disclosed to NCVER may be used or disclosed for the following purposes:"
            ),

            createParagraph(
              "• Issuing statements of attainment or qualification, and populating authenticated VET transcripts;\n• facilitating statistics and research relating to education, including surveys;\n• pre-populating RTO student enrolment forms\n• understanding how the VET market operates, for policy, workforce planning and consumer information; and\n• administering VET, including programme administration, regulation, monitoring and evaluation."
            ),

            createParagraph(
              "You may receive an NCVER student survey which may be administered by an NCVER employee, agent or third party contractor. You may opt out of the survey at the time of being contacted."
            ),

            createParagraph(
              "NCVER will collect, hold, use and disclose your personal information in accordance with the Privacy Act 1988 (Cth), the VET Data Policy and all NCVER policies and protocols (including those published on NCVER's website at www.ncver.edu.au)."
            ),

            createParagraph(
              "For more information about NCVER's Privacy Policy go to https://www.ncver.edu.au/privacy."
            ),

            createHeading(
              "Consent for publication of photographs and student work",
              HeadingLevel.HEADING_3
            ),

            createParagraph(
              "RTO occasionally takes photos of students participating in classes for publicity purposes. These photos may be displayed on our website. The names and details of the people in the photos are not released or published. Staff will always identify when they are taking photos so students who don't wish to have their photo taken can be excluded from the photo. If at any time your photo is published on the website and you would like it removed, we will do so within 24 hours of receiving a written request to remove it."
            ),

            // Consent checkbox
            new Paragraph({
              children: [
                new TextRun({
                  text: "Do you consent to the use of your photo under these conditions? Please circle one: ",
                  bold: true,
                }),
                new TextRun({
                  text: declarations.photoConsent === "Yes" ? "Yes" : "No",
                }),
              ],
              spacing: { before: 100, after: 100 },
            }),

            createParagraph(
              "If you indicated NO please ensure you advise the staff member at the time the photo is being taken to ensure you are excluded from the photo."
            ),

            createHeading(
              "Consent/authority to release information and view documents",
              HeadingLevel.HEADING_3
            ),

            createParagraph(
              "Please be assured that any discussions held with this representative will be for the purposes of your assessment and for your skills development."
            ),

            createParagraph(
              "During the process we do not plan to discuss your evidence or work practices with other trainees, unless we have your written permission to do so."
            ),

            createParagraph(
              "You are required to give permission in writing for any of these discussions or viewing of evidence to occur."
            ),

            createCheckbox(
              "I will be required to participate in the completion of a National Students Outcomes Survey [NCVER], during the course of my training program.",
              true
            ),

            createHeading(
              "Declaration of Information Accuracy",
              HeadingLevel.HEADING_3
            ),

            createParagraph(
              "In signing or emailing this form I acknowledge and declare that;"
            ),

            createParagraph(
              "1. I have read and understood and consent to the privacy notice and have completed all questions and details on the enrolment forms.\n2. Arrangements have been made to pay all fees and charges applicable to this enrolment.\n3. I have read and understand the RTO Information for Learners Handbook\n4. I agree to be bound by the RTO's Student Code of Conduct, regulations, policies and disciplinary procedures whilst I remain an enrolled student.\n5. I am 18 years of age or older, or have permission to access the internet from my parent(s) or guardian(s) if under 18.\n6. My participation in this course is subject to the right of RTO to cancel or amalgamate courses or classes. I agree to abide by all rules and regulations of RTO.\n7. I understand and have been provided with information by RTO in relation to Credit Transfer and Recognition of Prior Learning (RPL).\n8. I confirm that I have been informed about the training, assessment and support services to be provided, and about my rights and obligations as a student at RTO.\n9. I have also visited RTO website to review Training and Assessment options available to me including but not limited to duration, location, mode of delivery and work placement (if any), fees, refunds, complaints and withdrawals.\n10. I authorise RTO or its agent, in the event of illness or accident during any RTO organised activity, and where emergency contact next of kin cannot be contacted within reasonable time, to seek ambulance, medical or surgical treatment at my cost.\n11. My academic results will be withheld until my debit is fully paid and any property belonging to RTO has been returned.\n12. I acknowledge that from time to time RTO may send me information regarding course opportunities and other promotional offers and that I have the ability to opt out.\n13. I declare that the information I have provided to the best of my knowledge is true and correct.\n14. I consent to the collection, use and disclosure of my personal information in accordance with the Privacy Notice above."
            ),

            createSignatureLine(
              "Signed (Student)",
              declarations.studentSignature || ""
            ),
            createFormField("Date: ", declarations.date || ""),

            createSignatureLine(
              "Signed (PARENT/GUARDIAN)",
              declarations.parentSignature || ""
            ),
            createFormField("Date: ", declarations.parentDate || ""),

            createParagraph(
              "*Parental/guardian consent is required for all students under the age of 18."
            ),

            // PAGE BREAK
            createSectionBreak(),

            // DISABILITY SUPPLEMENT
            createTitle("Disability supplement", HeadingLevel.HEADING_2),

            createHeading("Introduction", HeadingLevel.HEADING_3),

            createParagraph(
              "The purpose of the Disability supplement is to provide additional information to assist with answering the disability question."
            ),

            createParagraph(
              "If you indicated the presence of a disability, impairment or long-term condition, please select the area(s) in the following list:"
            ),

            createParagraph(
              "Disability in this context does not include short-term disabling health conditions such as a fractured leg, influenza, or corrected physical conditions such as impaired vision managed by wearing glasses or lenses."
            ),

            createHeading("'11 — Hearing/deaf'", HeadingLevel.HEADING_3),

            createParagraph(
              "Hearing impairment is used to refer to a person who has an acquired mild, moderate, severe or profound hearing loss after learning to speak, communicates orally and maximises residual hearing with the assistance of amplification. A person who is deaf has a severe or profound hearing loss from, at, or near birth and mainly relies upon vision to communicate, whether through lip reading, gestures, cued speech, finger spelling and/or sign language."
            ),

            createHeading("'12 — Physical'", HeadingLevel.HEADING_3),

            createParagraph(
              "A physical disability affects the mobility or dexterity of a person and may include a total or partial loss of a part of the body. A physical disability may have existed since birth or may be the result of an accident, illness, or injury suffered later in life; for example, amputation, arthritis, cerebral palsy, multiple sclerosis, muscular dystrophy, paraplegia, quadriplegia or post-polio syndrome."
            ),

            createHeading("'13 — Intellectual'", HeadingLevel.HEADING_3),

            createParagraph(
              "In general, the term 'intellectual disability' is used to refer to low general intellectual functioning and difficulties in adaptive behaviour, both of which conditions were manifested before the person reached the age of 18. It may result from infection before or after birth, trauma during birth, or illness."
            ),

            createHeading("'14 — Learning'", HeadingLevel.HEADING_3),

            createParagraph(
              "A general term that refers to a heterogeneous group of disorders manifested by significant difficulties in the acquisition and use of listening, speaking, reading, writing, reasoning, or mathematical abilities. These disorders are intrinsic to the individual, presumed to be due to central nervous system dysfunction, and may occur across the life span. Problems in self-regulatory behaviours, social perception, and social interaction may exist with learning disabilities but do not by themselves constitute a learning disability."
            ),

            createHeading("'15 — Mental illness'", HeadingLevel.HEADING_3),

            createParagraph(
              "Mental illness refers to a cluster of psychological and physiological symptoms that cause a person suffering or distress and which represent a departure from a person's usual pattern and level of functioning."
            ),

            createHeading(
              "'16 — Acquired brain impairment'",
              HeadingLevel.HEADING_3
            ),

            createParagraph(
              "Acquired brain impairment is injury to the brain that results in deterioration in cognitive, physical, emotional or independent functioning. Acquired brain impairment can occur as a result of trauma, hypoxia, infection, tumour, accidents, violence, substance abuse, degenerative neurological diseases or stroke. These impairments may be either temporary or permanent and cause partial or total disability or psychosocial maladjustment."
            ),

            createHeading("'17 — Vision'", HeadingLevel.HEADING_3),

            createParagraph(
              "This covers a partial loss of sight causing difficulties in seeing, up to and including blindness. This may be present from birth or acquired as a result of disease, illness or injury."
            ),

            createHeading("'18 — Medical condition'", HeadingLevel.HEADING_3),

            createParagraph(
              "Medical condition is a temporary or permanent condition that may be hereditary, genetically acquired or of unknown origin. The condition may not be obvious or readily identifiable, yet may be mildly or severely debilitating and result in fluctuating levels of wellness and sickness, and/or periods of hospitalisation; for example, HIV/AIDS, cancer, chronic fatigue syndrome, Crohn's disease, cystic fibrosis, asthma or diabetes."
            ),

            createHeading("'19 — Other'", HeadingLevel.HEADING_3),

            createParagraph(
              "A disability, impairment or long-term condition which is not suitably described by one or several disability types in combination. Autism spectrum disorders are reported under this category."
            ),

            // Add RTO information at the bottom
            createParagraph(
              "RTO CODE: 45282\nALPHA TRAINING & RECOGNITION PTY LTD\n9/2172 Gold Coast Highway Miami QLD 4220\nRTO NO: 45282 | ABN: 27 620 188 105\nEmail: admin@atr.edu.au| P: 0422 714 443"
            ),

            // PRE-TRAINING REVIEW SECTION
            createSectionBreak(),

            createTitle("Pre-Training Review", HeadingLevel.HEADING_2),

            createFormField(
              "Name of Course or Qualification: ",
              courseSelection.selectedCourse || ""
            ),
            createFormField(
              "Student Name: ",
              personalDetails.firstName +
                " " +
                personalDetails.middleNames +
                " " +
                personalDetails.familyName
            ),

            createHeading("Introduction", HeadingLevel.HEADING_3),

            createParagraph(
              "A Pre-Training Review ensures that the learning and assessment strategy meets your individual needs."
            ),

            createParagraph(
              "The pre-training review ensures:\n• Understand your objectives for undertaking this course\n• Explores your current competencies and provides opportunities for these to be assessed through Recognition of Prior Learning (RPL), Recognition of Current Competency (RCC) or Credit Transfer (CT)"
            ),

            createHeading(
              "Instructions for all Students",
              HeadingLevel.HEADING_3
            ),

            createParagraph(
              "Before completing the Pre-Training Review, make sure you have sufficient information about the course. In particular, you must have access to the following information;"
            ),

            createParagraph(
              "- Training and Assessment arrangements i.e., duration of the course, training and assessment modes, days of training, assessments to be completed\n- Employment prospects - You should conduct your own research and have strong evidence of employability options on completion of the course\n- Recognition of prior learning and credit transfer application process\n- Fees and refund charges applicable for the training\n- Your rights and obligations as a student at ALPHA TRAINING & RECOGNITION - Entry requirements into the course"
            ),

            createHeading(
              "Instructions for completing PTR",
              HeadingLevel.HEADING_3
            ),

            createParagraph(
              "Please ensure each question is answered as accurately as possible. If you require more space to write your response to a question, please attach a second sheet and number the responses."
            ),

            createHeading(
              "Part A: Your expectations and experience",
              HeadingLevel.HEADING_3
            ),

            new Paragraph({
              children: [
                new TextRun({
                  text: "1) Your expectations - What do you hope to gain from undertaking this qualification?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createTextBox(preTrainingInterview?.expectations || ""),

            new Paragraph({
              children: [
                new TextRun({
                  text: "2) Previous Experience and Current Competencies – One way we can assess your current competencies is to look at the different job roles within your work history and ascertain their relevance to the course you intend to undertake.",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: "a) Please write a brief description of your current position OR attach a Position Description.",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createTextBox(preTrainingInterview?.currentPosition || ""),

            new Paragraph({
              children: [
                new TextRun({
                  text: "b) Provide your last 3 job titles and how long you were employed in each position.",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createFormField("1", preTrainingInterview?.jobTitle1 || ""),
            createFormField("2", preTrainingInterview?.jobTitle2 || ""),
            createFormField("3", preTrainingInterview?.jobTitle3 || ""),

            new Paragraph({
              children: [
                new TextRun({
                  text: "(c) Recognition of Prior Learning (RPL)\nRecognition of Current Competency (RCC)\nCredit Transfer (CT)",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createParagraph("(Proof should be submitted for consideration)"),

            new Paragraph({
              children: [
                new TextRun({
                  text: "I. Have you acquired any formal training in any of the qualifications you wish to enroll into?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createCheckbox(
              "Yes",
              preTrainingInterview?.formalTraining === "Yes"
            ),
            createCheckbox("No", preTrainingInterview?.formalTraining === "No"),

            createParagraph(
              "(Please obtain a course structure from the admissions officer or current prospectus)"
            ),

            new Paragraph({
              children: [
                new TextRun({
                  text: "II. Do you wish to apply for RPL?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createCheckbox("Yes", preTrainingInterview?.applyRPL === "Yes"),
            createCheckbox("No", preTrainingInterview?.applyRPL === "No"),

            createParagraph(
              "(The Trainer or Training Manager will explain the RPL process and the documents required as evidence for your claim)"
            ),

            // PAGE BREAK
            createSectionBreak(),

            createHeading("Part B", HeadingLevel.HEADING_3),

            createParagraph(
              "Following information will help us to determine, you're learning and styles and if we are able to deliver courses that meet your learning styles."
            ),

            // Learning styles checklist
            createParagraph("Tick the most relevant"),

            createCheckbox(
              "Textbooks that I can read and refer to in my own time",
              learningStyles.includes(
                "Textbooks that I can read and refer to in my own time"
              )
            ),
            createCheckbox(
              "Power Points explained to me during classes",
              learningStyles.includes(
                "Power Points explained to me during classes"
              )
            ),
            createCheckbox(
              "Pictures and diagrams",
              learningStyles.includes("Pictures and diagrams")
            ),
            createCheckbox(
              "Group discussions with others",
              learningStyles.includes("Group discussions with others")
            ),
            createCheckbox(
              "Conducting my own research",
              learningStyles.includes("Conducting my own research")
            ),
            createCheckbox(
              "Listening to the lectures/ trainers",
              learningStyles.includes("Listening to the lectures/ trainers")
            ),
            createCheckbox(
              "Practical application of skills and knowledge in a workplace or similar or watching videos",
              learningStyles.includes(
                "Practical application of skills and knowledge in a workplace or similar or watching videos"
              )
            ),
            createCheckbox(
              "Working through real examples such as a case study or scenario",
              learningStyles.includes(
                "Working through real examples such as a case study or scenario"
              )
            ),
            createCheckbox(
              "Other (please explain below)",
              preTrainingInterview?.otherLearningStyle ? true : false
            ),

            createFormField(
              "Other learning style: ",
              preTrainingInterview?.otherLearningStyle || ""
            ),

            // Additional support section
            new Paragraph({
              children: [
                new TextRun({
                  text: "What additional support do you think you will need in order to complete this course successfully?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createCheckbox(
              "English language support",
              additionalSupport.includes("English language support")
            ),
            createCheckbox(
              "Reading support",
              additionalSupport.includes("Reading support")
            ),
            createCheckbox(
              "Writing support",
              additionalSupport.includes("Writing support")
            ),
            createCheckbox(
              "One-on-one guidance",
              additionalSupport.includes("One-on-one guidance")
            ),
            createCheckbox(
              "Additional resources",
              additionalSupport.includes("Additional resources")
            ),
            createCheckbox(
              "Other:",
              preTrainingInterview?.otherSupport ? true : false
            ),

            createFormField(
              "Other support: ",
              preTrainingInterview?.otherSupport || ""
            ),

            createSignatureLine(
              "Student Name",
              preTrainingInterview?.studentName || ""
            ),
            createFormField("Date: ", preTrainingInterview?.date || ""),

            // LANGUAGE, LITERACY & NUMERACY TEST SECTION
            createSectionBreak(),

            createTitle(
              "Language, Literacy & Numeracy Test",
              HeadingLevel.HEADING_2
            ),

            createFormField(
              "Student's Name: ",
              personalDetails.firstName +
                " " +
                personalDetails.middleNames +
                " " +
                personalDetails.familyName || ""
            ),
            createFormField("Student ID (If Known): ", ""),
            createFormField("Date of Birth: ", personalDetails.dob || ""),
            createFormField("Date: ", ""),

            createHeading(
              "Instructions to the Student:",
              HeadingLevel.HEADING_3
            ),

            createParagraph(
              "• Written responses must be recorded in the space provided\n• You need to score a minimum of 40 marks\n• This assessment contains three parts: Reading & Writing; English Grammar; and Numeracy\n• You are not allowed to use a translator or Smart Phone.\n• Calculators are not allowed\n• You are allowed to use an English-to-English dictionary\n• If you do not understand any questions, you can speak to the assessor/trainer\n• If you require more space, attach additional pages\n• Maximum time allocated: 1 hour"
            ),

            createSectionBreak(),

            // PART A - ORAL COMMUNICATION
            createHeading(
              "Part A – Oral Communication",
              HeadingLevel.HEADING_2
            ),

            createParagraph(
              "You will receive a maximum of 5 marks for each question. You will be assessed against the following criteria:"
            ),

            createParagraph(
              "-Communicative Effectiveness (Communicate confidently)\n-Intelligibility (Use the natural flow of speech, giving stress to particular words within sentences to emphasise meaning)\n-Fluency (Maintain a natural speed to make it easier for the listener to follow)\n-Appropriateness (Use suitable, professional language)\n-Resources of Grammar and Expression (Use appropriate structures to make what you are saying coherent)"
            ),

            // Oral Communication Questions
            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 1. Can you tell me about something that you learned recently? How did you learn it?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createParagraph(
              "People learn new skills every day, such as how to use the internet and how to record TV shows."
            ),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[0]) || ""
            ),

            createParagraph("Marks _____"),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 2. What do you like about learning? Can you talk about how you think you like to learn? What helps you to learn?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createParagraph(
              "People learn in different ways. Some learn best by listening and writing, some from visual aids such as the whiteboard or the TV and some learn by watching and doing."
            ),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[1]) || ""
            ),

            createParagraph("Marks _____"),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 3. What are you good at?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createParagraph(
              "This may include reading (newspapers, emails, websites, notice boards, manuals); writing (letters, emails, forms, lists, messages, reports); numeracy (calculations, times tables, 24-hour clock, measurement, money and finance); speaking and listening (talking on the phone, asking for information, giving instructions or presentations)."
            ),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[2]) || ""
            ),

            createParagraph("Marks _____"),

            // Continue with more questions...
            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 4. What would you like to learn?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createParagraph(
              "This might include specific vocational tasks, or it may be more general, such as reading novels or TV guides or writing letters."
            ),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[3]) || ""
            ),

            createParagraph("Marks _____"),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 5. What helps you to learn? Are there barriers, for example the need for glasses; medication or family issues; unsuccessful previous schooling; English as a second language?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createParagraph(
              "Some may be able to identify a preference for small groups, extra time, one-on-one support, a mentor, a tape recorder, a computer, a dictionary, a calculator etc."
            ),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[4]) || ""
            ),

            createParagraph("Marks _____"),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 6. When did you leave school? Have you been enrolled in training (vocational training or tertiary studies) since you left school? If yes, which courses?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[5]) || ""
            ),

            createParagraph("Marks _____"),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 7. Which skills would you require to pursue your career?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[6]) || ""
            ),

            createParagraph("Marks _____"),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 8. What sort of maths did you use at work? Did you use a calculator, count stock and materials, or measure? Did you use calculations? Give directions? Read maps?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[7]) || ""
            ),

            createParagraph("Marks _____"),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 9. What work skills do you already have? Team work using technology, communication, self-management, problem solving, learning, initiative and planning.",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[8]) || ""
            ),

            createParagraph("Marks _____"),

            new Paragraph({
              children: [
                new TextRun({
                  text: "Question 10. What skills would you like to develop from this course?",
                  bold: true,
                }),
              ],
              spacing: { before: 100, after: 20 },
            }),

            createTextBox(
              (llnAssessment?.oralAnswers && llnAssessment.oralAnswers[9]) || ""
            ),

            createParagraph("Marks _____"),

            createParagraph("Total marks for Part A _____"),

            // Add Part B and Part C sections for Reading/Writing and Numeracy
            // These would be extensive and similar to Part A in format

            // Add LLN Assessment Summary at the end
            createSectionBreak(),

            createHeading(
              "LLN Skills Assessment Summary (office use only)",
              HeadingLevel.HEADING_2
            ),

            createParagraph(
              "Trainer to complete based on the response provided in the LL&N Assessment"
            ),

            // Assessment Scoring table
            new Table({
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                insideVertical: { style: BorderStyle.SINGLE, size: 1 },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ text: "Assessment", bold: true }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ text: "Scoring", bold: true }),
                      ],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          text: "ACSF level of performance (if applicable)",
                          bold: true,
                        }),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ text: "Part 1: Oral Communication" }),
                      ],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "/50" })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "" })],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ text: "Part 2: Reading and Writing" }),
                      ],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "/50" })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "" })],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: "Part 3: Numeracy" })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "/25" })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "" })],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ text: "Total Marks", bold: true }),
                      ],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "/125", bold: true })],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "" })],
                    }),
                  ],
                }),
              ],
            }),

            createCheckbox(
              "Competent language, literacy and numeracy skills to complete the Training Program",
              true
            ),

            createCheckbox(
              "Extra language, literacy or numeracy assistance will/may be required during the Training Program",
              false
            ),

            createParagraph("Comments/Action:"),
            createTextBox(""),

            createParagraph(
              "(Trainer to document extra assistance strategy on Training Plan)"
            ),

            createFormField("Trainer/Coordinators Name: ", ""),
            createFormField("Date: ", ""),

            createSignatureLine("Trainer/Coordinators Signature", ""),

            createParagraph(
              "Instructions to the Trainer/Assessor conducting the LLN Skills Assessment"
            ),

            createParagraph(
              "Now you need to make a judgement about whether to refer this person for a more thorough language, literacy and numeracy skill assessment, or not."
            ),
          ],
        },
      ],
    });

    // Generate the DOCX document
    const buffer = await Packer.toBuffer(doc);

    // Write the buffer to the temp file
    fs.writeFileSync(tempFilePath, buffer);

    try {
      // Define storage path
      const storagePath = `enrollment-forms/${userId}/${applicationId}/enrollment_form.docx`;

      // Upload to Firebase Storage
      const fileRef = bucket.file(storagePath);

      await fileRef.save(buffer, {
        metadata: {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });

      // Generate signed URL
      const [url] = await fileRef.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Update application in Firestore
      await db.collection("applications").doc(applicationId).update({
        enrollmentFormUrl: url,
        enrollmentFormPath: storagePath,
        enrollmentFormGenerated: true,
        enrollmentFormGeneratedAt: new Date(),
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      return {
        success: true,
        fileUrl: url,
        path: storagePath,
      };
    } catch (error) {
      // Clean up temp file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      console.error("Error generating enrollment form:", error);
      throw new Error(`Error generating enrollment form: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in generateEnrollmentForm:", error);
    throw new Error(`Error in generateEnrollmentForm: ${error.message}`);
  }
};

module.exports = { generateEnrollmentPdf };
