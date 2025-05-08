const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");
const os = require("os");

const fillEnrolmentForm = async (
  formData,
  applicationId,
  userId,
  db,
  bucket
) => {
  try {
    const tempDir = path.join(os.tmpdir(), "enrolment-forms");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Load PDF template
    const templatePath = path.join(__dirname, "../RtoForms/enrollmentKit.pdf");
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Get page dimensions for reference
    const page1 = pdfDoc.getPage(0);
    const { width, height } = page1.getSize();

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Helper functions
    const addText = (pageIndex, text, x, y, fontSize = 8) => {
      if (text) {
        const page = pdfDoc.getPage(pageIndex);
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }
    };

    // Use a cross mark (X) for checkboxes
    const addCheckmark = (pageIndex, x, y) => {
      const page = pdfDoc.getPage(pageIndex);
      page.drawText("x", {
        x,
        y,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
    };

    // Field coordinates mapping based on the actual PDF layout
    // Coordinates adjusted based on PDF page height of approximately 792 points
    const coords = {
      // ===== PAGE 0 =====
      // Section 1: Personal Details
      title: { page: 0, x: 170, y: 690 },
      gender: {
        male: { page: 0, x: 170, y: 600 },
        female: { page: 0, x: 230, y: 700 },
        other: { page: 0, x: 290, y: 700 },
      },
      familyName: { page: 0, x: 170, y: 610 },
      firstName: { page: 0, x: 170, y: 600 },
      middleNames: { page: 0, x: 390, y: 590 },
      preferredName: { page: 0, x: 120, y: 590 },
      dob: { page: 0, x: 360, y: 615 },

      // Section 2: Contact Details
      homePhone: { page: 0, x: 110, y: 575 },
      mobilePhone: { page: 0, x: 300, y: 575 },
      email: { page: 0, x: 110, y: 550 },
      workPhone: { page: 0, x: 300, y: 550 },
      altEmail: { page: 0, x: 110, y: 525 },
      preferredContact: {
        mobile: { page: 0, x: 315, y: 500 },
        email: { page: 0, x: 400, y: 500 },
        post: { page: 0, x: 460, y: 500 },
      },

      // Section 3: Emergency Contact
      emergencyName: { page: 0, x: 90, y: 460 },
      emergencyRelationship: { page: 0, x: 320, y: 460 },
      emergencyHomePhone: { page: 0, x: 90, y: 435 },
      emergencyMobile: { page: 0, x: 240, y: 435 },
      emergencyWorkPhone: { page: 0, x: 390, y: 435 },

      // Section 4: Residential Address
      residentialBuilding: { page: 0, x: 150, y: 370 },
      residentialFlat: { page: 0, x: 150, y: 345 },
      residentialStreetNo: { page: 0, x: 150, y: 320 },
      residentialStreet: { page: 0, x: 150, y: 295 },
      residentialSuburb: { page: 0, x: 150, y: 270 },
      residentialState: { page: 0, x: 150, y: 245 },
      residentialPostcode: { page: 0, x: 150, y: 220 },

      // ===== PAGE 1 =====
      // Section 5: Postal Address
      postalBuilding: { page: 1, x: 200, y: 660 },
      postalFlat: { page: 1, x: 200, y: 650 },
      postalStreetNo: { page: 1, x: 200, y: 640 },
      postalStreet: { page: 1, x: 200, y: 630 },
      postalPOBox: { page: 1, x: 200, y: 620 },
      postalSuburb: { page: 1, x: 200, y: 610 },
      postalState: { page: 1, x: 200, y: 600 },
      postalPostcode: { page: 1, x: 150, y: 590 },

      // Section 6: Workplace Details
      employerTradingName: { page: 1, x: 150, y: 510 },
      employerContactName: { page: 1, x: 150, y: 485 },
      employerSupervisor: { page: 1, x: 400, y: 485 },
      employerTrainingAddress: { page: 1, x: 150, y: 460 },
      employerPhone: { page: 1, x: 150, y: 435 },
      employerEmail: { page: 1, x: 400, y: 435 },

      // Section 7: Cultural Diversity
      indigenousStatus: {
        no: { page: 1, x: 80, y: 380 },
        aboriginal: { page: 1, x: 80, y: 360 },
        torres: { page: 1, x: 80, y: 340 },
        both: { page: 1, x: 80, y: 320 },
      },
      countryOfBirth: {
        australia: { page: 1, x: 80, y: 280 },
        other: { page: 1, x: 80, y: 260 },
      },
      otherCountry: { page: 1, x: 200, y: 260 },
      otherLanguage: {
        no: { page: 1, x: 80, y: 230 },
        yes: { page: 1, x: 80, y: 210 },
      },
      languageName: { page: 1, x: 200, y: 210 },
      englishProficiency: {
        veryWell: { page: 1, x: 80, y: 180 },
        well: { page: 1, x: 160, y: 180 },
        notWell: { page: 1, x: 240, y: 180 },
        notAtAll: { page: 1, x: 320, y: 180 },
      },

      // Section 8: USI
      usiNumber: { page: 1, x: 150, y: 140 },

      // ===== PAGE 2 =====
      // Section 9: USI Application
      birthCity: { page: 2, x: 150, y: 700 },
      identityType: {
        driversLicense: { page: 2, x: 80, y: 650 },
        medicare: { page: 2, x: 80, y: 620 },
        immicard: { page: 2, x: 80, y: 590 },
        certificateDescent: { page: 2, x: 80, y: 560 },
        birthCert: { page: 2, x: 80, y: 530 },
        ausPassport: { page: 2, x: 80, y: 500 },
        foreignPassport: { page: 2, x: 80, y: 470 },
        citizenshipCert: { page: 2, x: 80, y: 440 },
      },

      // ===== PAGE 3 =====
      // Section 10: Education
      enrolledInSchool: {
        no: { page: 3, x: 80, y: 730 },
        yes: { page: 3, x: 120, y: 730 },
      },
      highestSchoolLevel: {
        year12: { page: 3, x: 80, y: 690 },
        year11: { page: 3, x: 80, y: 670 },
        year10: { page: 3, x: 80, y: 650 },
        year9: { page: 3, x: 80, y: 630 },
        year8: { page: 3, x: 80, y: 610 },
        neverAttended: { page: 3, x: 80, y: 590 },
      },
      completionYear: { page: 3, x: 300, y: 690 },
      currentSchool: { page: 3, x: 300, y: 660 },
      previousSchool: { page: 3, x: 300, y: 630 },

      // Section 11: Employment Status
      employmentStatus: {
        unpaidFamily: { page: 3, x: 80, y: 550 },
        selfEmployed: { page: 3, x: 80, y: 530 },
        notEmployed: { page: 3, x: 80, y: 510 },
        fullTime: { page: 3, x: 80, y: 490 },
        partTime: { page: 3, x: 80, y: 470 },
        employer: { page: 3, x: 80, y: 450 },
        unemployedFull: { page: 3, x: 80, y: 430 },
        unemployedPart: { page: 3, x: 80, y: 410 },
      },

      // Continue mapping remaining sections similarly...

      // ===== PAGE 8 =====
      // Signatures
      studentSignature: { page: 8, x: 100, y: 180 },
      studentDate: { page: 8, x: 350, y: 180 },
      parentSignature: { page: 8, x: 100, y: 150 },
      parentDate: { page: 8, x: 350, y: 150 },
    };

    // Fill Personal Details (Section 1)
    const pd = formData.personalDetails;
    addText(coords.title.page, pd.title, coords.title.x, coords.title.y);
    addText(
      coords.familyName.page,
      pd.familyName,
      coords.familyName.x,
      coords.familyName.y
    );
    addText(
      coords.firstName.page,
      pd.firstName,
      coords.firstName.x,
      coords.firstName.y
    );
    addText(
      coords.middleNames.page,
      pd.middleNames,
      coords.middleNames.x,
      coords.middleNames.y
    );
    addText(
      coords.preferredName.page,
      pd.preferredName,
      coords.preferredName.x,
      coords.preferredName.y
    );

    // Format date as DD/MM/YYYY
    if (pd.dob) {
      const dob = new Date(pd.dob);
      const formattedDob = `${dob.getDate().toString().padStart(2, "0")}/${(
        dob.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}/${dob.getFullYear()}`;
      addText(coords.dob.page, formattedDob, coords.dob.x, coords.dob.y);
    }

    // Gender checkbox
    if (pd.gender === "Male") {
      addCheckmark(
        coords.gender.male.page,
        coords.gender.male.x,
        coords.gender.male.y
      );
    } else if (pd.gender === "Female") {
      addCheckmark(
        coords.gender.female.page,
        coords.gender.female.x,
        coords.gender.female.y
      );
    } else {
      addCheckmark(
        coords.gender.other.page,
        coords.gender.other.x,
        coords.gender.other.y
      );
    }

    // Contact Details (Section 2)
    const cd = formData.contactDetails;
    addText(
      coords.homePhone.page,
      cd.homePhone,
      coords.homePhone.x,
      coords.homePhone.y
    );
    addText(
      coords.mobilePhone.page,
      cd.mobilePhone,
      coords.mobilePhone.x,
      coords.mobilePhone.y
    );
    addText(coords.email.page, cd.email, coords.email.x, coords.email.y);
    addText(
      coords.workPhone.page,
      cd.workPhone,
      coords.workPhone.x,
      coords.workPhone.y
    );
    addText(
      coords.altEmail.page,
      cd.altEmail,
      coords.altEmail.x,
      coords.altEmail.y
    );

    // Preferred contact method
    if (cd.preferredContact === "Mobile Phone") {
      addCheckmark(
        coords.preferredContact.mobile.page,
        coords.preferredContact.mobile.x,
        coords.preferredContact.mobile.y
      );
    } else if (cd.preferredContact === "Email") {
      addCheckmark(
        coords.preferredContact.email.page,
        coords.preferredContact.email.x,
        coords.preferredContact.email.y
      );
    } else if (cd.preferredContact === "Post") {
      addCheckmark(
        coords.preferredContact.post.page,
        coords.preferredContact.post.x,
        coords.preferredContact.post.y
      );
    }

    // Emergency Contact (Section 3)
    const ec = formData.emergencyContact;
    addText(
      coords.emergencyName.page,
      ec.name,
      coords.emergencyName.x,
      coords.emergencyName.y
    );
    addText(
      coords.emergencyRelationship.page,
      ec.relationship,
      coords.emergencyRelationship.x,
      coords.emergencyRelationship.y
    );
    addText(
      coords.emergencyHomePhone.page,
      ec.homePhone,
      coords.emergencyHomePhone.x,
      coords.emergencyHomePhone.y
    );
    addText(
      coords.emergencyMobile.page,
      ec.mobilePhone,
      coords.emergencyMobile.x,
      coords.emergencyMobile.y
    );
    addText(
      coords.emergencyWorkPhone.page,
      ec.workPhone,
      coords.emergencyWorkPhone.x,
      coords.emergencyWorkPhone.y
    );

    // Residential Address (Section 4)
    const ra = formData.residentialAddress;
    addText(
      coords.residentialBuilding.page,
      ra.buildingName,
      coords.residentialBuilding.x,
      coords.residentialBuilding.y
    );
    addText(
      coords.residentialFlat.page,
      ra.flatDetails,
      coords.residentialFlat.x,
      coords.residentialFlat.y
    );
    addText(
      coords.residentialStreetNo.page,
      ra.streetNumber,
      coords.residentialStreetNo.x,
      coords.residentialStreetNo.y
    );
    addText(
      coords.residentialStreet.page,
      ra.streetName,
      coords.residentialStreet.x,
      coords.residentialStreet.y
    );
    addText(
      coords.residentialSuburb.page,
      ra.suburb,
      coords.residentialSuburb.x,
      coords.residentialSuburb.y
    );
    addText(
      coords.residentialState.page,
      ra.state,
      coords.residentialState.x,
      coords.residentialState.y
    );
    addText(
      coords.residentialPostcode.page,
      ra.postcode,
      coords.residentialPostcode.x,
      coords.residentialPostcode.y
    );

    // Postal Address (Section 5) - only if different from residential
    if (formData.postalAddress && formData.postalAddress.different) {
      const pa = formData.postalAddress;
      addText(
        coords.postalBuilding.page,
        pa.buildingName,
        coords.postalBuilding.x,
        coords.postalBuilding.y
      );
      addText(
        coords.postalFlat.page,
        pa.flatDetails,
        coords.postalFlat.x,
        coords.postalFlat.y
      );
      addText(
        coords.postalStreetNo.page,
        pa.streetNumber,
        coords.postalStreetNo.x,
        coords.postalStreetNo.y
      );
      addText(
        coords.postalStreet.page,
        pa.streetName,
        coords.postalStreet.x,
        coords.postalStreet.y
      );
      addText(
        coords.postalPOBox.page,
        pa.postalDelivery,
        coords.postalPOBox.x,
        coords.postalPOBox.y
      );
      addText(
        coords.postalSuburb.page,
        pa.suburb,
        coords.postalSuburb.x,
        coords.postalSuburb.y
      );
      addText(
        coords.postalState.page,
        pa.state,
        coords.postalState.x,
        coords.postalState.y
      );
      addText(
        coords.postalPostcode.page,
        pa.postcode,
        coords.postalPostcode.x,
        coords.postalPostcode.y
      );
    }

    // Workplace Details (Section 6)
    const ed = formData.employmentDetails;
    if (ed) {
      addText(
        coords.employerTradingName.page,
        ed.tradingName,
        coords.employerTradingName.x,
        coords.employerTradingName.y
      );
      addText(
        coords.employerContactName.page,
        ed.contactName,
        coords.employerContactName.x,
        coords.employerContactName.y
      );
      addText(
        coords.employerSupervisor.page,
        ed.supervisorName,
        coords.employerSupervisor.x,
        coords.employerSupervisor.y
      );
      addText(
        coords.employerTrainingAddress.page,
        ed.trainingAddress,
        coords.employerTrainingAddress.x,
        coords.employerTrainingAddress.y
      );
      addText(
        coords.employerPhone.page,
        ed.phone,
        coords.employerPhone.x,
        coords.employerPhone.y
      );
      addText(
        coords.employerEmail.page,
        ed.employeeEmail,
        coords.employerEmail.x,
        coords.employerEmail.y
      );
    }

    // Cultural Diversity (Section 7)
    const cd2 = formData.culturalDiversity;
    if (cd2) {
      // Indigenous Status
      if (cd2.indigenousStatus === "No") {
        addCheckmark(
          coords.indigenousStatus.no.page,
          coords.indigenousStatus.no.x,
          coords.indigenousStatus.no.y
        );
      } else if (cd2.indigenousStatus === "Yes, Aboriginal") {
        addCheckmark(
          coords.indigenousStatus.aboriginal.page,
          coords.indigenousStatus.aboriginal.x,
          coords.indigenousStatus.aboriginal.y
        );
      } else if (cd2.indigenousStatus === "Yes, Torres Strait Islander") {
        addCheckmark(
          coords.indigenousStatus.torres.page,
          coords.indigenousStatus.torres.x,
          coords.indigenousStatus.torres.y
        );
      } else if (cd2.indigenousStatus === "Yes, Aboriginal & T.S. Islander") {
        addCheckmark(
          coords.indigenousStatus.both.page,
          coords.indigenousStatus.both.x,
          coords.indigenousStatus.both.y
        );
      }

      // Country of Birth
      if (cd2.countryOfBirth === "Australia") {
        addCheckmark(
          coords.countryOfBirth.australia.page,
          coords.countryOfBirth.australia.x,
          coords.countryOfBirth.australia.y
        );
      } else if (cd2.countryOfBirth === "Other") {
        addCheckmark(
          coords.countryOfBirth.other.page,
          coords.countryOfBirth.other.x,
          coords.countryOfBirth.other.y
        );
        addText(
          coords.otherCountry.page,
          cd2.otherCountry,
          coords.otherCountry.x,
          coords.otherCountry.y
        );
      }

      // Language other than English
      if (cd2.otherLanguage === "No") {
        addCheckmark(
          coords.otherLanguage.no.page,
          coords.otherLanguage.no.x,
          coords.otherLanguage.no.y
        );
      } else if (cd2.otherLanguage === "Yes") {
        addCheckmark(
          coords.otherLanguage.yes.page,
          coords.otherLanguage.yes.x,
          coords.otherLanguage.yes.y
        );
        addText(
          coords.languageName.page,
          cd2.specifyLanguage,
          coords.languageName.x,
          coords.languageName.y
        );
      }

      // English Proficiency
      if (cd2.englishProficiency === "Very Well") {
        addCheckmark(
          coords.englishProficiency.veryWell.page,
          coords.englishProficiency.veryWell.x,
          coords.englishProficiency.veryWell.y
        );
      } else if (cd2.englishProficiency === "Well") {
        addCheckmark(
          coords.englishProficiency.well.page,
          coords.englishProficiency.well.x,
          coords.englishProficiency.well.y
        );
      } else if (cd2.englishProficiency === "Not well") {
        addCheckmark(
          coords.englishProficiency.notWell.page,
          coords.englishProficiency.notWell.x,
          coords.englishProficiency.notWell.y
        );
      } else if (cd2.englishProficiency === "Not at all") {
        addCheckmark(
          coords.englishProficiency.notAtAll.page,
          coords.englishProficiency.notAtAll.x,
          coords.englishProficiency.notAtAll.y
        );
      }
    }

    // USI Details (Section 8)
    if (formData.usiDetails && formData.usiDetails.usiNumber) {
      addText(
        coords.usi.page,
        formData.usiDetails.usiNumber,
        coords.usi.x,
        coords.usi.y
      );
    }

    // Continue with additional sections as needed...
    // The approach would be similar for education, employment status, etc.

    // Save filled PDF
    const filledPdfBytes = await pdfDoc.save();
    const fileName = `enrolment_${applicationId}_${Date.now()}.pdf`;
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, filledPdfBytes);

    // Upload to Firebase
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `applications/${userId}/${applicationId}/enrolment/${fileName}`;
    const fileRef = bucket.file(storagePath);

    await fileRef.save(fileBuffer, {
      metadata: { contentType: "application/pdf" },
    });

    // Get download URL
    const [url] = await fileRef.getSignedUrl({
      action: "read",
      expires: "03-01-2500",
    });

    // Update application record
    await db.collection("applications").doc(applicationId).update({
      enrolmentFormUrl: url,
      updatedAt: new Date().toISOString(),
    });

    // Cleanup
    fs.unlinkSync(filePath);

    return { success: true, fileUrl: url };
  } catch (error) {
    console.error("Error filling enrolment form:", error);
    throw new Error(`Enrolment form processing failed: ${error.message}`);
  }
};

module.exports = { fillEnrolmentForm };
