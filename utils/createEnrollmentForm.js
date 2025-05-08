// const path = require("path");
// const os = require("os");
// const fs = require("fs").promises;
// const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

// /**
//  * Generates a PDF document with enrollment form questions and answers
//  * @param {Object} formData - The form data containing answers
//  * @param {string} applicationId - The application ID
//  * @param {string} userId - The user ID
//  * @param {Object} db - Firestore database instance
//  * @param {Object} bucket - Firebase storage bucket
//  * @returns {Promise<Object>} - Object containing success status and file URL
//  */
// const generateEnrollmentPdf = async (
//   formData,
//   applicationId,
//   userId,
//   db,
//   bucket
// ) => {
//   console.log(formData);
//   try {
//     // Create temporary directory for PDF
//     const tempDir = path.join(os.tmpdir(), "enrollment-documents");
//     try {
//       await fs.mkdir(tempDir, { recursive: true });
//     } catch (err) {
//       // Directory might already exist, that's fine
//       if (err.code !== "EEXIST") throw err;
//     }

//     // Create a new PDF document
//     const pdfDoc = await PDFDocument.create();

//     // Embed fonts
//     const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
//     const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
//     const helveticaOblique = await pdfDoc.embedFont(
//       StandardFonts.HelveticaOblique
//     );

//     // Define page dimensions
//     const pageWidth = 612; // 8.5 inches
//     const pageHeight = 792; // 11 inches
//     const margin = 50;

//     // Helper function to add a new page
//     const addNewPage = () => {
//       const page = pdfDoc.addPage([pageWidth, pageHeight]);
//       return page;
//     };

//     // Helper function to add section title
//     const addSectionTitle = (page, title, y) => {
//       page.drawText(title, {
//         x: margin,
//         y,
//         size: 14,
//         font: helveticaBold,
//         color: rgb(0, 0, 0),
//       });

//       // Draw a line under the title
//       page.drawLine({
//         start: { x: margin, y: y - 5 },
//         end: { x: pageWidth - margin, y: y - 5 },
//         thickness: 1,
//         color: rgb(0, 0, 0),
//       });

//       return y - 30; // Return new y position
//     };

//     // Helper function to safely process text for PDF
//     const sanitizeForPdf = (text) => {
//       if (text === null || text === undefined) return "Not provided";

//       // Convert to string
//       const str = String(text);

//       // Replace problematic characters
//       return str.replace(/\n/g, " ").replace(/[\x00-\x1F\x7F-\x9F]/g, "");
//     };

//     // Helper function to format complex objects more thoroughly
//     const formatComplexObject = (obj) => {
//       if (obj === null || obj === undefined) return "Not provided";
//       if (typeof obj !== "object") return String(obj);

//       if (Array.isArray(obj)) {
//         // Format array items with more detail
//         return obj
//           .map((item) =>
//             typeof item === "object" ? formatComplexObject(item) : String(item)
//           )
//           .join(", ");
//       }

//       // Process objects with more detail
//       const entries = Object.entries(obj);
//       if (entries.length === 0) return "Empty object";

//       return entries
//         .map(([key, value]) => {
//           if (typeof value === "object" && value !== null) {
//             return `${key}: ${formatComplexObject(value)}`;
//           }
//           return `${key}: ${value}`;
//         })
//         .join(" | ");
//     };

//     // Helper function to add question and answer
//     const addQuestionAnswer = (page, question, answer, y) => {
//       // Check if we need a new page
//       if (y < margin + 50) {
//         page = addNewPage();
//         y = pageHeight - margin;
//       }

//       // Add question
//       page.drawText(question, {
//         x: margin,
//         y,
//         size: 10,
//         font: helveticaBold,
//         color: rgb(0, 0, 0),
//       });

//       // Process answer to handle encoding issues
//       let answerText = answer ? sanitizeForPdf(answer) : "Not provided";

//       // If answer is too long, split it into multiple lines
//       const maxWidth = pageWidth - 2 * margin;
//       const words = answerText.split(" ");
//       let lines = [];
//       let currentLine = "";

//       for (const word of words) {
//         const testLine = currentLine ? `${currentLine} ${word}` : word;

//         try {
//           const textWidth = helveticaFont.widthOfTextAtSize(testLine, 10);

//           if (textWidth < maxWidth) {
//             currentLine = testLine;
//           } else {
//             lines.push(currentLine);
//             currentLine = word;
//           }
//         } catch (err) {
//           // If there's an encoding error, try to safely handle it
//           console.warn(`Warning: encoding issue with text: ${err.message}`);

//           // Skip the problematic word
//           if (currentLine) {
//             lines.push(currentLine);
//             currentLine = "";
//           }
//         }
//       }

//       if (currentLine) {
//         lines.push(currentLine);
//       }

//       // If no lines (empty answer), add "Not provided"
//       if (lines.length === 0) {
//         lines.push("Not provided");
//       }

//       // Draw each line of the answer
//       let answerY = y - 15;
//       for (const line of lines) {
//         // Check if we need a new page
//         if (answerY < margin) {
//           page = addNewPage();
//           answerY = pageHeight - margin;
//         }

//         try {
//           page.drawText(line, {
//             x: margin + 10,
//             y: answerY,
//             size: 10,
//             font: helveticaFont,
//             color: rgb(0, 0, 0),
//           });
//         } catch (err) {
//           // If there's still an issue, try with a placeholder
//           console.warn(`Skipping problematic text: ${err.message}`);
//           page.drawText("[Text contains unsupported characters]", {
//             x: margin + 10,
//             y: answerY,
//             size: 10,
//             font: helveticaFont,
//             color: rgb(0, 0, 0),
//           });
//         }

//         answerY -= 15;
//       }

//       return { page, y: answerY - 10 }; // Return new page and y position
//     };

//     // Special function for signature fields - highlighted differently
//     const addSignatureField = (page, question, answer, y) => {
//       // Check if we need a new page
//       if (y < margin + 50) {
//         page = addNewPage();
//         y = pageHeight - margin;
//       }

//       // Add question in blue and italic
//       page.drawText(question, {
//         x: margin,
//         y,
//         size: 10,
//         font: helveticaOblique,
//         color: rgb(0, 0.5, 1), // Blue color
//       });

//       // Process answer
//       let answerText = answer ? sanitizeForPdf(answer) : "Not provided";

//       // Draw a signature line
//       page.drawLine({
//         start: { x: margin + 10, y: y - 20 },
//         end: { x: pageWidth - margin - 100, y: y - 20 },
//         thickness: 1,
//         color: rgb(0, 0.5, 1), // Blue color
//       });

//       // Draw the signature text
//       try {
//         page.drawText(answerText, {
//           x: margin + 10,
//           y: y - 15,
//           size: 10,
//           font: helveticaOblique,
//           color: rgb(0, 0.5, 1), // Blue color
//         });
//       } catch (err) {
//         // If there's still an issue, try with a placeholder
//         console.warn(`Skipping problematic signature text: ${err.message}`);
//         page.drawText("[Signature]", {
//           x: margin + 10,
//           y: y - 15,
//           size: 10,
//           font: helveticaOblique,
//           color: rgb(0, 0.5, 1),
//         });
//       }

//       return { page, y: y - 30 }; // Return new page and y position
//     };

//     // Add title page
//     let page = addNewPage();
//     let y = pageHeight - margin;

//     // Add title
//     page.drawText("ENROLLMENT FORM RESPONSES", {
//       x: margin,
//       y,
//       size: 20,
//       font: helveticaBold,
//       color: rgb(0, 0, 0),
//     });

//     y -= 30;

//     // Add reference ID
//     page.drawText(`Reference ID: ${applicationId || ""}`, {
//       x: margin,
//       y,
//       size: 12,
//       font: helveticaFont,
//       color: rgb(0, 0, 0),
//     });

//     y -= 20;

//     // Add qualification
//     const qualificationName =
//       formData.courseSelection?.selectedCourse || "Not specified";
//     page.drawText(`Qualification: ${sanitizeForPdf(qualificationName)}`, {
//       x: margin,
//       y,
//       size: 12,
//       font: helveticaFont,
//       color: rgb(0, 0, 0),
//     });

//     y -= 20;

//     // Add date
//     const currentDate = new Date().toLocaleDateString();
//     page.drawText(`Date: ${currentDate}`, {
//       x: margin,
//       y,
//       size: 12,
//       font: helveticaFont,
//       color: rgb(0, 0, 0),
//     });

//     // Add a new page for the form content
//     page = addNewPage();
//     y = pageHeight - margin;

//     // Define all sections and questions from the enrollment form
//     const sections = [
//       {
//         title: "1. Personal Details",
//         questions: [
//           { key: "title", question: "Title (Mr, Miss, Ms, Mrs, Other):" },
//           { key: "gender", question: "Gender:" },
//           { key: "familyName", question: "Family name (Surname):" },
//           { key: "firstName", question: "First Name:" },
//           { key: "middleNames", question: "Middle Name(s):" },
//           { key: "preferredName", question: "Preferred Name:" },
//           { key: "dob", question: "Date of Birth:" },
//         ],
//       },
//       {
//         title: "2. Contact Details",
//         questions: [
//           { key: "homePhone", question: "Home Phone:" },
//           { key: "mobilePhone", question: "Mobile Phone:" },
//           { key: "email", question: "Email Address:" },
//           { key: "workPhone", question: "Work Phone:" },
//           { key: "altEmail", question: "Alternative email address:" },
//           { key: "preferredContact", question: "Preferred Contact Method:" },
//         ],
//       },
//       {
//         title: "3. Emergency Contact",
//         questions: [
//           { key: "name", question: "Name:" },
//           { key: "relationship", question: "Relationship:" },
//           { key: "homePhone", question: "Home Phone:" },
//           { key: "mobilePhone", question: "Mobile Phone:" },
//           { key: "workPhone", question: "Work Phone:" },
//         ],
//       },
//       {
//         title: "4. Residential Address",
//         questions: [
//           { key: "buildingName", question: "Building/property name:" },
//           { key: "flatDetails", question: "Flat/unit details:" },
//           { key: "streetNumber", question: "Street or lot number:" },
//           { key: "streetName", question: "Street name:" },
//           { key: "suburb", question: "Suburb, locality or town:" },
//           { key: "state", question: "State/territory:" },
//           { key: "postcode", question: "Postcode:" },
//         ],
//       },
//       {
//         title: "5. Postal Address",
//         questions: [
//           {
//             key: "different",
//             question: "Is postal address different from residential address?",
//           },
//           { key: "buildingName", question: "Building/property name:" },
//           { key: "flatDetails", question: "Flat/unit details:" },
//           { key: "streetNumber", question: "Street or lot number:" },
//           { key: "streetName", question: "Street name:" },
//           {
//             key: "postalDelivery",
//             question: "Postal delivery information (e.g. PO Box):",
//           },
//           { key: "suburb", question: "Suburb, locality or town:" },
//           { key: "state", question: "State/territory:" },
//           { key: "postcode", question: "Postcode:" },
//         ],
//       },
//       {
//         title: "6. Workplace Employer Details",
//         questions: [
//           { key: "tradingName", question: "Trading Name:" },
//           { key: "contactName", question: "Contact Name:" },
//           { key: "supervisorName", question: "Supervisor Name:" },
//           { key: "trainingAddress", question: "Training Address:" },
//           { key: "phone", question: "Phone:" },
//           { key: "employeeEmail", question: "Employer email:" },
//         ],
//       },
//       {
//         title: "7. Language and Cultural Diversity",
//         questions: [
//           {
//             key: "indigenousStatus",
//             question: "Are you of Aboriginal/Torres Strait Islander origin?",
//           },
//           {
//             key: "countryOfBirth",
//             question: "In which country were you born?",
//           },
//           {
//             key: "otherCountry",
//             question: "If not Australia, specify country:",
//           },
//           {
//             key: "otherLanguage",
//             question: "Do you speak a language other than English at home?",
//           },
//           { key: "specifyLanguage", question: "If yes, which language?" },
//           {
//             key: "englishProficiency",
//             question: "How well do you speak English?",
//           },
//         ],
//       },
//       {
//         title: "8. USI Details",
//         questions: [
//           { key: "usiNumber", question: "Unique Student Identifier (USI):" },
//           {
//             key: "createUSI",
//             question: "Do you want RTO to create a USI on your behalf?",
//           },
//           { key: "birthCity", question: "Town/City of Birth:" },
//           {
//             key: "identityType",
//             question: "Type of identity document provided:",
//           },
//         ],
//       },
//       {
//         title: "10. Education Details",
//         questions: [
//           {
//             key: "enrolledInSchool",
//             question:
//               "Are you still enrolled in secondary or senior secondary education?",
//           },
//           {
//             key: "highestSchoolLevel",
//             question: "What is your highest COMPLETED school level?",
//           },
//           {
//             key: "completionYear",
//             question: "In which year did you complete this school level?",
//           },
//           {
//             key: "currentSchool",
//             question: "If still attending school, name of school:",
//           },
//           {
//             key: "previousSchool",
//             question: "Previous secondary school (if applicable):",
//           },
//         ],
//       },
//       {
//         title: "11. Employment Status",
//         questions: [
//           {
//             key: "currentStatus",
//             question:
//               "Which of the following categories BEST describes your current employment status?",
//           },
//           {
//             key: "employeeCount",
//             question: "How many employees are at your current employer?",
//           },
//         ],
//       },
//       {
//         title: "14. Disability",
//         questions: [
//           {
//             key: "hasDisability",
//             question:
//               "Do you consider yourself to have a disability, impairment or long term condition?",
//           },
//           {
//             key: "disabilityTypes",
//             question:
//               "If yes, please indicate the areas of disability, impairment or long term condition:",
//           },
//           {
//             key: "otherDisability",
//             question: "Other disability (please specify):",
//           },
//         ],
//       },
//       {
//         title: "15. Previous Qualifications/Education",
//         questions: [
//           {
//             key: "completedQualifications",
//             question:
//               "Have you successfully COMPLETED any of the following qualifications?",
//           },
//           {
//             key: "qualificationType",
//             question: "If yes, please indicate which qualifications:",
//           },
//         ],
//       },
//       {
//         title: "16. Study Reason",
//         questions: [
//           {
//             key: "mainReason",
//             question:
//               "Of the following reasons, which BEST describes your main reason for undertaking this course/traineeship/apprenticeship?",
//           },
//           {
//             key: "discoveryMethod",
//             question:
//               "How did you find out about the course you are enrolling in?",
//           },
//         ],
//       },
//       {
//         title: "19. Australian Citizenship Status",
//         questions: [
//           { key: "status", question: "Citizenship Status:" },
//           { key: "otherDetails", question: "Other details (if applicable):" },
//         ],
//       },
//       {
//         title: "20. Program / Qualification",
//         questions: [
//           {
//             key: "selectedCourse",
//             question: "Program / Qualification to be enrolled in:",
//           },
//         ],
//       },
//       {
//         title: "21. Pre-Training Checklist",
//         questions: [
//           { key: "items", question: "Pre-training checklist items:" },
//           {
//             key: "specialNeeds",
//             question:
//               "Please indicate any special needs, assistance you may require during the course:",
//           },
//         ],
//       },
//       {
//         title: "Declarations",
//         questions: [
//           {
//             key: "readHandbook",
//             question: "I have read and understand the RTO student handbook:",
//           },
//           {
//             key: "privacyConsent",
//             question:
//               "I consent to the collection, use and disclosure of my personal information:",
//           },
//           {
//             key: "photoConsent",
//             question:
//               "Do you consent to the use of your photo under these conditions?",
//           },
//           {
//             key: "informationAccuracy",
//             question:
//               "I declare that the information I have provided is true and correct:",
//           },
//           {
//             key: "studentSignature",
//             question: "Student Signature:",
//             isSignature: true,
//           },
//           { key: "date", question: "Date:", isSignature: true },
//           {
//             key: "parentSignature",
//             question: "Parent/Guardian Signature (if under 18):",
//             isSignature: true,
//           },
//           {
//             key: "parentDate",
//             question: "Parent/Guardian Signature Date:",
//             isSignature: true,
//           },
//         ],
//       },
//       {
//         title: "Pre-Training Interview",
//         questions: [
//           {
//             key: "expectations",
//             question:
//               "What do you hope to gain from undertaking this qualification?",
//           },
//           {
//             key: "currentPosition",
//             question:
//               "Please write a brief description of your current position:",
//           },
//           { key: "jobTitle1", question: "Job Title 1:" },
//           { key: "jobTitle2", question: "Job Title 2:" },
//           { key: "jobTitle3", question: "Job Title 3:" },
//           {
//             key: "formalTraining",
//             question:
//               "Have you acquired any formal training in any of the qualifications you wish to enroll into?",
//           },
//           { key: "applyRPL", question: "Do you wish to apply for RPL?" },
//           {
//             key: "learningStyles",
//             question: "What learning styles do you prefer?",
//           },
//           {
//             key: "otherLearningStyle",
//             question: "Other learning style (please specify):",
//           },
//           {
//             key: "additionalSupport",
//             question:
//               "What additional support do you think you will need to complete this course successfully?",
//           },
//           { key: "otherSupport", question: "Other support (please specify):" },
//           { key: "studentName", question: "Student Name:", isSignature: true },
//           { key: "date", question: "Date:", isSignature: true },
//         ],
//       },
//       {
//         title: "Language, Literacy & Numeracy Assessment",
//         questions: [
//           // Part A questions
//           {
//             key: "partA_q1",
//             question:
//               "Question 1. What made you decide to enrol in this qualification? What do you hope to achieve from this training?",
//           },
//           {
//             key: "partA_q2",
//             question: "Question 2. Describe your previous work experience.",
//           },
//           {
//             key: "partA_q3",
//             question:
//               "Question 3. What reading, writing, math, or English skills do you use at work? Do you read instructions; write reports or fill in forms; use a calculator; read maps or drawings; or use measurements?",
//           },
//           {
//             key: "partA_q4",
//             question:
//               "Question 4. What would you like to learn? This might include specific vocational tasks, or it may be more general, such as reading novels or TV guides or writing letters.",
//           },
//           {
//             key: "partA_q5",
//             question:
//               "Question 5. What helps you to learn? Are there barriers, for example the need for glasses; medication or family issues; unsuccessful previous schooling; English as a second language.",
//           },
//           {
//             key: "partA_q6",
//             question:
//               "Question 6. When did you leave school? Have you been enrolled in training (vocational training or tertiary studies) since you left school? If yes, which courses?",
//           },
//           {
//             key: "partA_q7",
//             question:
//               "Question 7. Which skills would you require to pursue your career?",
//           },
//           {
//             key: "partA_q8",
//             question:
//               "Question 8. What sort of maths did you use at work? Did you use a calculator, count stock and materials, or measure? Did you use calculations? Give directions? Read maps?",
//           },
//           {
//             key: "partA_q9",
//             question:
//               "Question 9. What work skills do you already have? Team work using technology, communication, self-management, problem solving, learning, initiative and planning.",
//           },
//           {
//             key: "partA_q10",
//             question:
//               "Question 10. What skills would you like to develop from this course?",
//           },

//           // Part B questions
//           {
//             key: "partB_task1_q1",
//             question:
//               "Task 1: Reading Multiple Choice Q1. Most people don't mind working out...",
//           },
//           {
//             key: "partB_task1_q2",
//             question:
//               "Task 1: Reading Multiple Choice Q2. Communication is the sharing of information...",
//           },
//           {
//             key: "partB_task2",
//             question: "Task 2: Reading and Writing. Fill in the blanks.",
//           },
//           {
//             key: "partB_task3",
//             question:
//               "Task 3: Reading and Writing. Write summary from written text 'Parents' Born Order Affect Their Parenting'",
//           },
//           {
//             key: "partB_task4",
//             question: "Task 4: Writing. Describe image.",
//           },

//           // Part C questions
//           {
//             key: "partC_q1",
//             question:
//               "Question 1. A box holds 15 lettuces. At the end of the day the farm crew had filled 86 boxes. How many lettuces is that in total?",
//           },
//           {
//             key: "partC_q2",
//             question:
//               "Question 2. Diesel costs $1.86 per liter. The tractor's fuel tank is empty. When full it holds 1200 litres. How much money would it cost to fill up the tractor with fuel?",
//           },
//           {
//             key: "partC_q3a",
//             question:
//               "Question 3a. In which month was the petrol price the lowest?",
//           },
//           {
//             key: "partC_q3b",
//             question:
//               "Question 3b. In which two months was the price of petrol the same?",
//           },
//           {
//             key: "partC_q3c",
//             question:
//               "Question 3c. In which month was the price of petrol the highest?",
//           },
//           {
//             key: "partC_q3d",
//             question:
//               "Question 3d. In which month did the price of petrol increase the most?",
//           },
//           {
//             key: "partC_q3e",
//             question:
//               "Question 3e. What was the general trend in the price of petrol over this 12-months?",
//           },
//           {
//             key: "partC_q4",
//             question:
//               "Question 4. Superstores are having a sale. All items have been reduced by 30%. Complete the table to show the sale price of the items.",
//           },
//           {
//             key: "partC_q5",
//             question:
//               "Question 5. The perimeter of a rectangle is 64m. What are three possible measurements for the length and width? What is the area of these rectangles?",
//           },
//           {
//             key: "partC_q6",
//             question:
//               "Question 6. Fill in the gaps in the following table. Simplify the fraction in column one.",
//           },

//           // Assessment Summary section
//           {
//             key: "oralCommunication",
//             question: "Part 1: Oral Communication Score:",
//           },
//           {
//             key: "readingWriting",
//             question: "Part 2: Reading and Writing Score:",
//           },
//           { key: "numeracy", question: "Part 3: Numeracy Score:" },
//           { key: "totalScore", question: "Total Score:" },
//           { key: "competencyStatus", question: "Competency Status:" },
//           { key: "extraAssistance", question: "Extra Assistance Required:" },
//           { key: "comments", question: "Comments/Action:" },
//           { key: "trainerName", question: "Trainer/Coordinator's Name:" },
//           { key: "trainerDate", question: "Date:", isSignature: true },
//           {
//             key: "trainerSignature",
//             question: "Trainer/Coordinator's Signature:",
//             isSignature: true,
//           },
//         ],
//       },
//     ];

//     // Process each section
//     for (const section of sections) {
//       // Add section title
//       y = addSectionTitle(page, section.title, y);

//       // Get the relevant data for this section
//       let sectionData;
//       switch (section.title) {
//         case "1. Personal Details":
//           sectionData = formData.personalDetails;
//           break;
//         case "2. Contact Details":
//           sectionData = formData.contactDetails;
//           break;
//         case "3. Emergency Contact":
//           sectionData = formData.emergencyContact;
//           break;
//         case "4. Residential Address":
//           sectionData = formData.residentialAddress;
//           break;
//         case "5. Postal Address":
//           sectionData = formData.postalAddress;
//           break;
//         case "6. Workplace Employer Details":
//           sectionData = formData.employmentDetails;
//           break;
//         case "7. Language and Cultural Diversity":
//           sectionData = formData.culturalDiversity;
//           break;
//         case "8. USI Details":
//           sectionData = formData.usiDetails;
//           break;
//         case "10. Education Details":
//           sectionData = formData.educationDetails;
//           break;
//         case "11. Employment Status":
//           sectionData = formData.employmentStatus;
//           break;
//         case "14. Disability":
//           sectionData = formData.disability;
//           break;
//         case "15. Previous Qualifications/Education":
//           sectionData = formData.qualifications;
//           break;
//         case "16. Study Reason":
//           sectionData = formData.studyReason;
//           break;
//         case "19. Australian Citizenship Status":
//           sectionData = formData.citizenship;
//           break;
//         case "20. Program / Qualification":
//           sectionData = formData.courseSelection;
//           break;
//         case "21. Pre-Training Checklist":
//           sectionData = formData.preTrainingChecklist;
//           break;
//         case "Declarations":
//           sectionData = formData.declarations;
//           break;
//         case "Pre-Training Interview":
//           sectionData = formData.preTrainingInterview;
//           break;
//         case "Language, Literacy & Numeracy Assessment":
//           sectionData = formData.llnAssessment;
//           break;
//         default:
//           sectionData = {};
//       }

//       // Process each question in the section
//       for (const q of section.questions) {
//         let answer;

//         if (sectionData && q.key in sectionData) {
//           answer = sectionData[q.key];

//           // Format special cases
//           if (Array.isArray(answer)) {
//             // Handle arrays by joining with commas
//             answer = answer.join(", ");
//           } else if (typeof answer === "object" && answer !== null) {
//             // Handle objects in more specific ways
//             if (q.key === "qualificationType") {
//               // Format qualification types
//               const formattedQuals = [];
//               for (const [qualType, values] of Object.entries(answer)) {
//                 if (typeof values === "object" && values !== null) {
//                   const types = [];
//                   if (values.A) types.push("Australian");
//                   if (values.E) types.push("Australian Equivalent");
//                   if (values.I) types.push("International");
//                   if (types.length > 0) {
//                     formattedQuals.push(`${qualType}: ${types.join(", ")}`);
//                   }
//                 }
//               }
//               answer = formattedQuals.join(" | ");
//             } else if (q.key === "items") {
//               // Format pre-training checklist items
//               const items = [];
//               for (const [item, value] of Object.entries(answer)) {
//                 items.push(`${item}: ${value}`);
//               }
//               answer = items.join(" | ");
//             } else if (q.key === "numeracyAnswers") {
//               // Special handling for numeracy answers with nested objects
//               let formattedAnswers = [];

//               // Handle q1, q2 and their working notes
//               if (answer.q1) formattedAnswers.push(`Q1: ${answer.q1}`);
//               if (answer.q1Working)
//                 formattedAnswers.push(`Q1 Working: ${answer.q1Working}`);
//               if (answer.q2) formattedAnswers.push(`Q2: ${answer.q2}`);
//               if (answer.q2Working)
//                 formattedAnswers.push(`Q2 Working: ${answer.q2Working}`);

//               // Handle q3 array
//               // Continuing from the last part of the provided code...

//               // Handle q3 array
//               if (answer.q3 && Array.isArray(answer.q3)) {
//                 formattedAnswers.push(`Q3: ${answer.q3.join(", ")}`);
//               }

//               // Handle q4 data
//               if (answer.q4 && typeof answer.q4 === "object") {
//                 const q4Items = [];
//                 for (const [item, price] of Object.entries(answer.q4)) {
//                   q4Items.push(`${item}: ${price}`);
//                 }
//                 formattedAnswers.push(`Q4 items: ${q4Items.join(", ")}`);
//               }

//               // Handle q5 rectangle data
//               if (answer.q5 && Array.isArray(answer.q5)) {
//                 const rectangleData = answer.q5.map(
//                   (rect, idx) =>
//                     `Rectangle ${idx + 1}: Length ${rect.length}, Width ${
//                       rect.width
//                     }, Area ${rect.area}`
//                 );
//                 formattedAnswers.push(
//                   `Q5 rectangles: ${rectangleData.join(" | ")}`
//                 );
//               }

//               // Handle q6 fractions data
//               if (answer.q6 && Array.isArray(answer.q6)) {
//                 const fractionData = answer.q6.map(
//                   (frac) =>
//                     `Fraction: ${frac.fraction}, Decimal: ${frac.decimal}, Percentage: ${frac.percentage}`
//                 );
//                 formattedAnswers.push(
//                   `Q6 fractions: ${fractionData.join(" | ")}`
//                 );
//               }

//               answer = formattedAnswers.join(" | ");
//             } else {
//               // For any other complex object, use the general formatter
//               answer = formatComplexObject(answer);
//             }
//           }
//         } else {
//           answer = "Not provided";
//         }

//         // For signature fields, use special formatting
//         if (q.isSignature) {
//           const result = addSignatureField(page, q.question, answer, y);
//           page = result.page;
//           y = result.y;
//         } else {
//           // For regular questions, use standard formatting
//           const result = addQuestionAnswer(page, q.question, answer, y);
//           page = result.page;
//           y = result.y;
//         }
//       }
//     }

//     // Finalize the PDF content
//     const pdfBytes = await pdfDoc.save();

//     // Write the PDF to a temporary file
//     const pdfPath = path.join(tempDir, `enrollment-form-${applicationId}.pdf`);
//     await fs.writeFile(pdfPath, pdfBytes);

//     // Upload the PDF to Firebase Storage
//     const filePath = `enrollment-documents/${userId}/${applicationId}.pdf`;
//     const file = bucket.file(filePath);

//     try {
//       await file.save(pdfBytes, {
//         metadata: {
//           contentType: "application/pdf",
//         },
//       });

//       console.log(`PDF successfully uploaded to ${filePath}`);

//       // Get a signed URL that expires in 7 days (604800 seconds)
//       const [signedUrl] = await file.getSignedUrl({
//         action: "read",
//         expires: Date.now() + 604800 * 1000,
//       });
//       let url = signedUrl;

//       // Store the document reference in Firestore
//       await db.collection("applications").doc(applicationId).update({
//         enrollmentDocumentUrl: url,
//         enrollmentDocumentPath: filePath,
//         enrollmentDocumentGenerated: true,
//         enrollmentDocumentGeneratedAt: new Date(),
//       });

//       // Clean up the temporary file
//       try {
//         await fs.unlink(pdfPath);
//       } catch (err) {
//         console.warn(`Warning: couldn't delete temporary file: ${err.message}`);
//       }

//       return {
//         success: true,
//         url: url,
//         path: filePath,
//       };
//     } catch (err) {
//       console.error("Error uploading PDF to storage:", err);
//       throw new Error(`Failed to upload PDF: ${err.message}`);
//     }
//   } catch (err) {
//     console.error("Error generating PDF:", err);
//     throw new Error(`Failed to generate enrollment PDF: ${err.message}`);
//   }
// };

// module.exports = { generateEnrollmentPdf };
const path = require("path");
const os = require("os");
const fs = require("fs").promises;
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

/**
 * Generates a PDF document with enrollment form questions and answers
 * @param {Object} formData - The form data containing answers
 * @param {string} applicationId - The application ID
 * @param {string} userId - The user ID
 * @param {Object} db - Firestore database instance
 * @param {Object} bucket - Firebase storage bucket
 * @returns {Promise<Object>} - Object containing success status and file URL
 */
const generateEnrollmentPdf = async (
  formData,
  applicationId,
  userId,
  db,
  bucket
) => {
  console.log(formData);
  try {
    // Create temporary directory for PDF
    const tempDir = path.join(os.tmpdir(), "enrollment-documents");
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, that's fine
      if (err.code !== "EEXIST") throw err;
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(
      StandardFonts.HelveticaOblique
    );

    // Define page dimensions
    const pageWidth = 612; // 8.5 inches
    const pageHeight = 792; // 11 inches
    const margin = 50;

    // Helper function to add a new page
    const addNewPage = () => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      return page;
    };

    // Helper function to add section title
    const addSectionTitle = (page, title, y) => {
      page.drawText(title, {
        x: margin,
        y,
        size: 14,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // Draw a line under the title
      page.drawLine({
        start: { x: margin, y: y - 5 },
        end: { x: pageWidth - margin, y: y - 5 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });

      return y - 30; // Return new y position
    };

    // Helper function to safely process text for PDF
    const sanitizeForPdf = (text) => {
      if (text === null || text === undefined) return "Not provided";

      // Convert to string
      const str = String(text);

      // Replace problematic characters
      return str.replace(/\n/g, " ").replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    };

    // Helper function to format complex objects more thoroughly
    const formatComplexObject = (obj) => {
      if (obj === null || obj === undefined) return "Not provided";
      if (typeof obj !== "object") return String(obj);

      if (Array.isArray(obj)) {
        // Format array items with more detail
        return obj
          .map((item) =>
            typeof item === "object" ? formatComplexObject(item) : String(item)
          )
          .join(", ");
      }

      // Process objects with more detail
      const entries = Object.entries(obj);
      if (entries.length === 0) return "Empty object";

      return entries
        .map(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            return `${key}: ${formatComplexObject(value)}`;
          }
          return `${key}: ${value}`;
        })
        .join(" | ");
    };

    // Helper function to add question and answer
    const addQuestionAnswer = (page, question, answer, y) => {
      // Check if we need a new page
      if (y < margin + 50) {
        page = addNewPage();
        y = pageHeight - margin;
      }

      // Add question
      page.drawText(question, {
        x: margin,
        y,
        size: 10,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // Process answer to handle encoding issues
      let answerText = answer ? sanitizeForPdf(answer) : "Not provided";

      // If answer is too long, split it into multiple lines
      const maxWidth = pageWidth - 2 * margin;
      const words = answerText.split(" ");
      let lines = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        try {
          const textWidth = helveticaFont.widthOfTextAtSize(testLine, 10);

          if (textWidth < maxWidth) {
            currentLine = testLine;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        } catch (err) {
          // If there's an encoding error, try to safely handle it
          console.warn(`Warning: encoding issue with text: ${err.message}`);

          // Skip the problematic word
          if (currentLine) {
            lines.push(currentLine);
            currentLine = "";
          }
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      // If no lines (empty answer), add "Not provided"
      if (lines.length === 0) {
        lines.push("Not provided");
      }

      // Draw each line of the answer
      let answerY = y - 15;
      for (const line of lines) {
        // Check if we need a new page
        if (answerY < margin) {
          page = addNewPage();
          answerY = pageHeight - margin;
        }

        try {
          page.drawText(line, {
            x: margin + 10,
            y: answerY,
            size: 10,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        } catch (err) {
          // If there's still an issue, try with a placeholder
          console.warn(`Skipping problematic text: ${err.message}`);
          page.drawText("[Text contains unsupported characters]", {
            x: margin + 10,
            y: answerY,
            size: 10,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }

        answerY -= 15;
      }

      return { page, y: answerY - 10 }; // Return new page and y position
    };

    // Special function for signature fields - highlighted differently
    const addSignatureField = (page, question, answer, y) => {
      // Check if we need a new page
      if (y < margin + 50) {
        page = addNewPage();
        y = pageHeight - margin;
      }

      // Add question in blue and italic
      page.drawText(question, {
        x: margin,
        y,
        size: 10,
        font: helveticaOblique,
        color: rgb(0, 0, 0.5, 1), // Blue color
      });

      // Process answer
      let answerText = answer ? sanitizeForPdf(answer) : "Not provided";

      // Draw a signature line
      page.drawLine({
        start: { x: margin + 10, y: y - 20 },
        end: { x: pageWidth - margin - 100, y: y - 20 },
        thickness: 1,
        color: rgb(0, 0.5, 1), // Blue color
      });

      // Draw the signature text
      try {
        page.drawText(answerText, {
          x: margin + 10,
          y: y - 15,
          size: 10,
          font: helveticaOblique,
          color: rgb(0, 0.5, 1), // Blue color
        });
      } catch (err) {
        // If there's still an issue, try with a placeholder
        console.warn(`Skipping problematic signature text: ${err.message}`);
        page.drawText("[Signature]", {
          x: margin + 10,
          y: y - 15,
          size: 10,
          font: helveticaOblique,
          color: rgb(0, 0.5, 1),
        });
      }

      return { page, y: y - 30 }; // Return new page and y position
    };

    // Add title page
    let page = addNewPage();
    let y = pageHeight - margin;

    // Add title
    page.drawText("ENROLLMENT FORM RESPONSES", {
      x: margin,
      y,
      size: 20,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    y -= 30;

    // Add reference ID
    page.drawText(`Reference ID: ${applicationId || ""}`, {
      x: margin,
      y,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    y -= 20;

    // Add qualification
    const qualificationName =
      formData.courseSelection?.selectedCourse || "Not specified";
    page.drawText(`Qualification: ${sanitizeForPdf(qualificationName)}`, {
      x: margin,
      y,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    y -= 20;

    // Add date
    const currentDate = new Date().toLocaleDateString();
    page.drawText(`Date: ${currentDate}`, {
      x: margin,
      y,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    // Add a new page for the form content
    page = addNewPage();
    y = pageHeight - margin;

    // Define all sections and questions from the enrollment form
    const sections = [
      {
        title: "1. Personal Details",
        questions: [
          { key: "title", question: "Title (Mr, Miss, Ms, Mrs, Other):" },
          { key: "gender", question: "Gender:" },
          { key: "familyName", question: "Family name (Surname):" },
          { key: "firstName", question: "First Name:" },
          { key: "middleNames", question: "Middle Name(s):" },
          { key: "preferredName", question: "Preferred Name:" },
          { key: "dob", question: "Date of Birth:" },
        ],
      },
      {
        title: "2. Contact Details",
        questions: [
          { key: "homePhone", question: "Home Phone:" },
          { key: "mobilePhone", question: "Mobile Phone:" },
          { key: "email", question: "Email Address:" },
          { key: "workPhone", question: "Work Phone:" },
          { key: "altEmail", question: "Alternative email address:" },
          { key: "preferredContact", question: "Preferred Contact Method:" },
        ],
      },
      {
        title: "3. Emergency Contact",
        questions: [
          { key: "name", question: "Name:" },
          { key: "relationship", question: "Relationship:" },
          { key: "homePhone", question: "Home Phone:" },
          { key: "mobilePhone", question: "Mobile Phone:" },
          { key: "workPhone", question: "Work Phone:" },
        ],
      },
      {
        title: "4. Residential Address",
        questions: [
          { key: "buildingName", question: "Building/property name:" },
          { key: "flatDetails", question: "Flat/unit details:" },
          { key: "streetNumber", question: "Street or lot number:" },
          { key: "streetName", question: "Street name:" },
          { key: "suburb", question: "Suburb, locality or town:" },
          { key: "state", question: "State/territory:" },
          { key: "postcode", question: "Postcode:" },
        ],
      },
      {
        title: "5. Postal Address",
        questions: [
          {
            key: "different",
            question: "Is postal address different from residential address?",
          },
          { key: "buildingName", question: "Building/property name:" },
          { key: "flatDetails", question: "Flat/unit details:" },
          { key: "streetNumber", question: "Street or lot number:" },
          { key: "streetName", question: "Street name:" },
          {
            key: "postalDelivery",
            question: "Postal delivery information (e.g. PO Box):",
          },
          { key: "suburb", question: "Suburb, locality or town:" },
          { key: "state", question: "State/territory:" },
          { key: "postcode", question: "Postcode:" },
        ],
      },
      {
        title: "6. Workplace Employer Details",
        questions: [
          { key: "tradingName", question: "Trading Name:" },
          { key: "contactName", question: "Contact Name:" },
          { key: "supervisorName", question: "Supervisor Name:" },
          { key: "trainingAddress", question: "Training Address:" },
          { key: "phone", question: "Phone:" },
          { key: "employeeEmail", question: "Employer email:" },
        ],
      },
      {
        title: "7. Language and Cultural Diversity",
        questions: [
          {
            key: "indigenousStatus",
            question: "Are you of Aboriginal/Torres Strait Islander origin?",
          },
          {
            key: "countryOfBirth",
            question: "In which country were you born?",
          },
          {
            key: "otherCountry",
            question: "If not Australia, specify country:",
          },
          {
            key: "otherLanguage",
            question: "Do you speak a language other than English at home?",
          },
          { key: "specifyLanguage", question: "If yes, which language?" },
          {
            key: "englishProficiency",
            question: "How well do you speak English?",
          },
        ],
      },
      {
        title: "8. USI Details",
        questions: [
          { key: "usiNumber", question: "Unique Student Identifier (USI):" },
          {
            key: "createUSI",
            question: "Do you want RTO to create a USI on your behalf?",
          },
          { key: "birthCity", question: "Town/City of Birth:" },
          {
            key: "identityType",
            question: "Type of identity document provided:",
          },
        ],
      },
      {
        title: "10. Education Details",
        questions: [
          {
            key: "enrolledInSchool",
            question:
              "Are you still enrolled in secondary or senior secondary education?",
          },
          {
            key: "highestSchoolLevel",
            question: "What is your highest COMPLETED school level?",
          },
          {
            key: "completionYear",
            question: "In which year did you complete this school level?",
          },
          {
            key: "currentSchool",
            question: "If still attending school, name of school:",
          },
          {
            key: "previousSchool",
            question: "Previous secondary school (if applicable):",
          },
        ],
      },
      {
        title: "11. Employment Status",
        questions: [
          {
            key: "currentStatus",
            question:
              "Which of the following categories BEST describes your current employment status?",
          },
          {
            key: "employeeCount",
            question: "How many employees are at your current employer?",
          },
        ],
      },
      {
        title: "14. Disability",
        questions: [
          {
            key: "hasDisability",
            question:
              "Do you consider yourself to have a disability, impairment or long term condition?",
          },
          {
            key: "disabilityTypes",
            question:
              "If yes, please indicate the areas of disability, impairment or long term condition:",
          },
          {
            key: "otherDisability",
            question: "Other disability (please specify):",
          },
        ],
      },
      {
        title: "15. Previous Qualifications/Education",
        questions: [
          {
            key: "completedQualifications",
            question:
              "Have you successfully COMPLETED any of the following qualifications?",
          },
          {
            key: "qualificationType",
            question: "If yes, please indicate which qualifications:",
          },
        ],
      },
      {
        title: "16. Study Reason",
        questions: [
          {
            key: "mainReason",
            question:
              "Of the following reasons, which BEST describes your main reason for undertaking this course/traineeship/apprenticeship?",
          },
          {
            key: "discoveryMethod",
            question:
              "How did you find out about the course you are enrolling in?",
          },
        ],
      },
      {
        title: "19. Australian Citizenship Status",
        questions: [
          { key: "status", question: "Citizenship Status:" },
          { key: "otherDetails", question: "Other details (if applicable):" },
        ],
      },
      {
        title: "20. Program / Qualification",
        questions: [
          {
            key: "selectedCourse",
            question: "Program / Qualification to be enrolled in:",
          },
        ],
      },
      {
        title: "21. Pre-Training Checklist",
        questions: [
          { key: "items", question: "Pre-training checklist items:" },
          {
            key: "specialNeeds",
            question:
              "Please indicate any special needs, assistance you may require during the course:",
          },
        ],
      },
      {
        title: "Declarations",
        questions: [
          {
            key: "readHandbook",
            question: "I have read and understand the RTO student handbook:",
          },
          {
            key: "privacyConsent",
            question:
              "I consent to the collection, use and disclosure of my personal information:",
          },
          {
            key: "photoConsent",
            question:
              "Do you consent to the use of your photo under these conditions?",
          },
          {
            key: "informationAccuracy",
            question:
              "I declare that the information I have provided is true and correct:",
          },
          {
            key: "studentSignature",
            question: "Student Signature:",
            isSignature: true,
          },
          { key: "date", question: "Date:", isSignature: true },
          {
            key: "parentSignature",
            question: "Parent/Guardian Signature (if under 18):",
            isSignature: true,
          },
          {
            key: "parentDate",
            question: "Parent/Guardian Signature Date:",
            isSignature: true,
          },
        ],
      },
      {
        title: "Pre-Training Interview",
        questions: [
          {
            key: "expectations",
            question:
              "What do you hope to gain from undertaking this qualification?",
          },
          {
            key: "currentPosition",
            question:
              "Please write a brief description of your current position:",
          },
          { key: "jobTitle1", question: "Job Title 1:" },
          { key: "jobTitle2", question: "Job Title 2:" },
          { key: "jobTitle3", question: "Job Title 3:" },
          {
            key: "formalTraining",
            question:
              "Have you acquired any formal training in any of the qualifications you wish to enroll into?",
          },
          { key: "applyRPL", question: "Do you wish to apply for RPL?" },
          {
            key: "learningStyles",
            question: "What learning styles do you prefer?",
          },
          {
            key: "otherLearningStyle",
            question: "Other learning style (please specify):",
          },
          {
            key: "additionalSupport",
            question:
              "What additional support do you think you will need to complete this course successfully?",
          },
          { key: "otherSupport", question: "Other support (please specify):" },
          { key: "studentName", question: "Student Name:", isSignature: true },
          { key: "date", question: "Date:", isSignature: true },
        ],
      },
      {
        title: "Language, Literacy & Numeracy Assessment",
        questions: [
          { key: "oralAnswers", question: "Oral Communication Responses:" },
          {
            key: "readingMultipleChoice",
            question: "Reading Multiple Choice Responses:",
          },
          { key: "fillBlanks", question: "Fill in the Blanks Responses:" },
          { key: "summary", question: "Summary Writing:" },
          { key: "imageDescription", question: "Image Description:" },
          {
            key: "numeracyAnswers",
            question: "Numeracy Answers:",
            isComplex: true,
          },
          { key: "oralValidated", question: "Oral Communication Validated:" },
          { key: "readingValidated", question: "Reading Validated:" },
          { key: "numeracyValidated", question: "Numeracy Validated:" },
          { key: "textSummary", question: "Text Summary:" },
        ],
      },
    ];

    // Process each section
    for (const section of sections) {
      // Add section title
      y = addSectionTitle(page, section.title, y);

      // Get the relevant data for this section
      let sectionData;
      switch (section.title) {
        case "1. Personal Details":
          sectionData = formData.personalDetails;
          break;
        case "2. Contact Details":
          sectionData = formData.contactDetails;
          break;
        case "3. Emergency Contact":
          sectionData = formData.emergencyContact;
          break;
        case "4. Residential Address":
          sectionData = formData.residentialAddress;
          break;
        case "5. Postal Address":
          sectionData = formData.postalAddress;
          break;
        case "6. Workplace Employer Details":
          sectionData = formData.employmentDetails;
          break;
        case "7. Language and Cultural Diversity":
          sectionData = formData.culturalDiversity;
          break;
        case "8. USI Details":
          sectionData = formData.usiDetails;
          break;
        case "10. Education Details":
          sectionData = formData.educationDetails;
          break;
        case "11. Employment Status":
          sectionData = formData.employmentStatus;
          break;
        case "14. Disability":
          sectionData = formData.disability;
          break;
        case "15. Previous Qualifications/Education":
          sectionData = formData.qualifications;
          break;
        case "16. Study Reason":
          sectionData = formData.studyReason;
          break;
        case "19. Australian Citizenship Status":
          sectionData = formData.citizenship;
          break;
        case "20. Program / Qualification":
          sectionData = formData.courseSelection;
          break;
        case "21. Pre-Training Checklist":
          sectionData = formData.preTrainingChecklist;
          break;
        case "Declarations":
          sectionData = formData.declarations;
          break;
        case "Pre-Training Interview":
          sectionData = formData.preTrainingInterview;
          break;
        case "Language, Literacy & Numeracy Assessment":
          sectionData = formData.llnAssessment;
          break;
        default:
          sectionData = {};
      }

      // Process each question in the section
      for (const q of section.questions) {
        let answer;

        if (sectionData && q.key in sectionData) {
          answer = sectionData[q.key];

          // Format special cases
          if (Array.isArray(answer)) {
            // Handle arrays by joining with commas
            answer = answer.join(", ");
          } else if (typeof answer === "object" && answer !== null) {
            // Handle objects in more specific ways
            if (q.key === "qualificationType") {
              // Format qualification types
              const formattedQuals = [];
              for (const [qualType, values] of Object.entries(answer)) {
                if (typeof values === "object" && values !== null) {
                  const types = [];
                  if (values.A) types.push("Australian");
                  if (values.E) types.push("Australian Equivalent");
                  if (values.I) types.push("International");
                  if (types.length > 0) {
                    formattedQuals.push(`${qualType}: ${types.join(", ")}`);
                  }
                }
              }
              answer = formattedQuals.join(" | ");
            } else if (q.key === "items") {
              // Format pre-training checklist items
              const items = [];
              for (const [item, value] of Object.entries(answer)) {
                items.push(`${item}: ${value}`);
              }
              answer = items.join(" | ");
            } else if (q.key === "numeracyAnswers") {
              // Special handling for numeracy answers with nested objects
              let formattedAnswers = [];

              // Handle q1, q2 and their working notes
              if (answer.q1) formattedAnswers.push(`Q1: ${answer.q1}`);
              if (answer.q1Working)
                formattedAnswers.push(`Q1 Working: ${answer.q1Working}`);
              if (answer.q2) formattedAnswers.push(`Q2: ${answer.q2}`);
              if (answer.q2Working)
                formattedAnswers.push(`Q2 Working: ${answer.q2Working}`);

              // Handle q3 array
              if (answer.q3 && Array.isArray(answer.q3)) {
                formattedAnswers.push(`Q3: ${answer.q3.join(", ")}`);
              }

              // Handle q4 array and working
              if (answer.q4 && Array.isArray(answer.q4)) {
                formattedAnswers.push(`Q4: ${answer.q4.join(", ")}`);
              }
              if (answer.q4Working)
                formattedAnswers.push(`Q4 Working: ${answer.q4Working}`);

              // Handle q5 - array of objects with length, width, area
              if (answer.q5 && Array.isArray(answer.q5)) {
                const areas = answer.q5.map(
                  (item, index) =>
                    `Area ${index + 1}: Length=${item.length}, Width=${
                      item.width
                    }, Area=${item.area}`
                );
                formattedAnswers.push(`Q5: ${areas.join(" | ")}`);
              }

              // Handle q6 - array of objects with fraction, decimal, percentage
              if (answer.q6 && Array.isArray(answer.q6)) {
                const conversions = answer.q6.map(
                  (item, index) =>
                    `Conversion ${index + 1}: Fraction=${
                      item.fraction
                    }, Decimal=${item.decimal}, Percentage=${item.percentage}`
                );
                formattedAnswers.push(`Q6: ${conversions.join(" | ")}`);
              }

              answer = formattedAnswers.join(" | ");
            } else if (q.key === "readingMultipleChoice") {
              // Format reading multiple choice responses
              const formattedResponses = [];

              for (const [questionNumber, selectedOptions] of Object.entries(
                answer
              )) {
                if (
                  Array.isArray(selectedOptions) &&
                  selectedOptions.length > 0
                ) {
                  formattedResponses.push(
                    `${questionNumber}: Options ${selectedOptions.join(", ")}`
                  );
                } else {
                  formattedResponses.push(`${questionNumber}: No selection`);
                }
              }

              answer = formattedResponses.join(" | ");
            } else if (q.isComplex) {
              // Use the new formatComplexObject function for other complex objects
              answer = formatComplexObject(answer);
            } else {
              // Generic object formatting
              try {
                answer = JSON.stringify(answer);
              } catch (err) {
                answer = "Complex object - cannot display";
              }
            }
          }
        } else {
          answer = "Not provided";
        }

        // Check if this is a signature field
        if (q.isSignature) {
          const result = addSignatureField(page, q.question, answer, y);
          page = result.page;
          y = result.y;
        } else {
          // Regular question and answer
          const result = addQuestionAnswer(page, q.question, answer, y);
          page = result.page;
          y = result.y;
        }
      }

      // Add some space after each section
      y -= 20;

      // If we're near the bottom of the page, add a new page
      if (y < margin + 100) {
        page = addNewPage();
        y = pageHeight - margin;
      }
    }

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `enrollment_${applicationId}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);
    await fs.writeFile(filePath, pdfBytes);

    // Upload to Firebase
    const fileBuffer = await fs.readFile(filePath);
    const storagePath = `applications/${userId}/${applicationId}/enrollment/${fileName}`;
    const fileRef = bucket.file(storagePath);

    // Upload with proper content type
    await fileRef.save(fileBuffer, {
      metadata: { contentType: "application/pdf" },
      resumable: true, // Enable resumable uploads for larger files
    });

    // Get download URL (with longer expiration for admin access)
    const [url] = await fileRef.getSignedUrl({
      action: "read",
      expires: "03-01-2500", // Long expiration date
    });

    // Update application record
    await db.collection("applications").doc(applicationId).update({
      enrollmentFormUrl: url,
      updatedAt: new Date().toISOString(),
      hasEnrollmentForm: true, // Flag to indicate enrollment form is available
    });

    // Clean up the temporary file
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.warn(
        `Warning: Could not delete temporary PDF file: ${err.message}`
      );
      // Continue execution even if cleanup fails
    }

    return {
      success: true,
      fileUrl: url,
      fileName: fileName,
    };
  } catch (error) {
    console.error("Error generating enrollment PDF:", error);

    // Add more detailed error reporting

    // Add more detailed error reporting
    let errorMessage = `Enrollment form processing failed: ${error.message}`;

    // Report stack trace in development environments
    if (process.env.NODE_ENV !== "production") {
      errorMessage += `\nStack: ${error.stack}`;
    }

    throw new Error(errorMessage);
  }
};

module.exports = { generateEnrollmentPdf };
