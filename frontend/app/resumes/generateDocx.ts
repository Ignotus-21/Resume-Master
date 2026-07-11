import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { ResumeData } from './types';

// Generate DOCX using 'docx' library
export const generateDocx = async (data: ResumeData) => {
    const children = [];

    // Header
    children.push(
        new Paragraph({
            text: data.user?.name || "Name",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
            text: [data.user?.email, data.user?.phone, data.user?.location, data.user?.linkedin].filter(Boolean).join(" | "),
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" })
    );

    // Experience
    if (data.experience?.length) {
        children.push(new Paragraph({ text: "EXPERIENCE", heading: HeadingLevel.HEADING_2 }));
        data.experience.forEach((exp) => {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: exp.role, bold: true, size: 24 })]
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: exp.company, italics: true }),
                        new TextRun({ text: `  |  ${exp.startDate} - ${exp.endDate || 'Present'}`, size: 20 })
                    ]
                }),
            );
            if (exp.bulletPoints?.length) {
                exp.bulletPoints.forEach((bp: string) => {
                    children.push(new Paragraph({ text: `• ${bp}`, indent: { left: 400 } }));
                });
            }
            children.push(new Paragraph({ text: "" }));
        });
    }

    // Education
    if (data.education?.length) {
        children.push(new Paragraph({ text: "EDUCATION", heading: HeadingLevel.HEADING_2 }));
        data.education.forEach((edu) => {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: edu.institution, bold: true })]
                }),
                new Paragraph({ text: `${edu.degree} in ${edu.fieldOfStudy}${edu.gpa ? ` (GPA: ${edu.gpa})` : ''}` }),
                new Paragraph({ text: `${edu.startDate} - ${edu.endDate}` }),
            );
            if (edu.coursework?.length) {
                children.push(new Paragraph({ text: `Relevant Coursework: ${edu.coursework.join(', ')}` }));
            }
            children.push(new Paragraph({ text: "" }));
        });
    }

    // Skills
    if (data.skills) {
        children.push(new Paragraph({ text: "SKILLS", heading: HeadingLevel.HEADING_2 }));
        if (Array.isArray(data.skills)) {
            // Handle array format
            children.push(new Paragraph({ text: data.skills.join(", ") }));
        } else {
            // Handle object format
            if (data.skills.languages?.length) {
                children.push(new Paragraph({ children: [new TextRun({ text: "Languages: ", bold: true }), new TextRun(data.skills.languages.join(", "))] }));
            }
            if (data.skills.frameworks?.length) {
                children.push(new Paragraph({ children: [new TextRun({ text: "Frameworks: ", bold: true }), new TextRun(data.skills.frameworks.join(", "))] }));
            }
            if (data.skills.tools?.length) {
                children.push(new Paragraph({ children: [new TextRun({ text: "Tools: ", bold: true }), new TextRun(data.skills.tools.join(", "))] }));
            }
            if (data.skills.other?.length) {
                children.push(new Paragraph({ children: [new TextRun({ text: "Other: ", bold: true }), new TextRun(data.skills.other.join(", "))] }));
            }
        }
    }

    // Projects
    if (data.projects?.length) {
        children.push(new Paragraph({ text: "PROJECTS", heading: HeadingLevel.HEADING_2 }));
        data.projects.forEach((proj) => {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: proj.title, bold: true })]
                })
            );
            if (proj.techStack?.length) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: `Stack: ${proj.techStack.join(', ')}`, italics: true })]
                }));
            }
            children.push(
                new Paragraph({ text: proj.description }),
                new Paragraph({ text: "" })
            );
        });
    }

    // Certificates
    if (data.certificates?.length) {
        children.push(new Paragraph({ text: "CERTIFICATES", heading: HeadingLevel.HEADING_2 }));
        data.certificates.forEach((cert) => {
            children.push(new Paragraph({
                children: [
                    new TextRun({ text: cert.name, bold: true }),
                    new TextRun({ text: cert.issuer ? ` - ${cert.issuer}` : '' }),
                    new TextRun({ text: cert.date ? ` (${cert.date})` : '', italics: true })
                ]
            }));
        });
    }

    // Achievements
    if (data.achievements?.length) {
        children.push(new Paragraph({ text: "ACHIEVEMENTS", heading: HeadingLevel.HEADING_2 }));
        data.achievements.forEach((ach) => {
            children.push(new Paragraph({
                children: [
                    new TextRun({ text: ach.title, bold: true }),
                    new TextRun({ text: ach.date ? ` (${ach.date})` : '', italics: true })
                ]
            }));
            if (ach.description) children.push(new Paragraph({ text: ach.description }));
        });
    }

    // Patents
    if (data.patents?.length) {
        children.push(new Paragraph({ text: "PATENTS", heading: HeadingLevel.HEADING_2 }));
        data.patents.forEach((pat) => {
            children.push(new Paragraph({
                children: [
                    new TextRun({ text: pat.title, bold: true }),
                    new TextRun({ text: pat.date ? ` (${pat.date})` : '', italics: true })
                ]
            }));
            if (pat.number) children.push(new Paragraph({ children: [new TextRun({ text: `Patent #: ${pat.number}`, italics: true })] }));
            if (pat.description) children.push(new Paragraph({ text: pat.description }));
        });
    }

    // Volunteering
    if (data.volunteering?.length) {
        children.push(new Paragraph({ text: "VOLUNTEERING", heading: HeadingLevel.HEADING_2 }));
        data.volunteering.forEach((vol) => {
            children.push(new Paragraph({
                children: [
                    new TextRun({ text: vol.organization, bold: true }),
                    new TextRun({ text: ` - ${vol.role}`, italics: true }),
                    ...(vol.startDate || vol.endDate ? [new TextRun({ text: `  |  ${vol.startDate || ''} - ${vol.endDate || ''}`, size: 20 })] : [])
                ]
            }));
            if (vol.description) children.push(new Paragraph({ text: vol.description }));
        });
    }

    // Custom Sections
    if (data.customSections?.length) {
        data.customSections.forEach((section) => {
            if (!section.items?.length) return;
            children.push(new Paragraph({ text: section.title.toUpperCase(), heading: HeadingLevel.HEADING_2 }));
            section.items.forEach((item) => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: item.title, bold: true }),
                        new TextRun({ text: item.subtitle ? ` - ${item.subtitle}` : '' }),
                        new TextRun({ text: item.date ? ` (${item.date})` : '', italics: true })
                    ]
                }));
                if (item.description) children.push(new Paragraph({ text: item.description }));
            });
        });
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });

    return await Packer.toBlob(doc);
};
