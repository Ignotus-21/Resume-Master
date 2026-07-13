import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { ResumeContent, DesignTokens, SectionKey } from '@/lib/resumeSchema';
import { DEFAULT_DESIGN, sectionTitle, sectionHasContent } from '@/lib/resumeSchema';

// DOCX is a SIBLING RENDERER of the same IR the PDF renders from
// (content + design) — same section order, same hidden sections, same
// renamed titles. Layout fidelity is best-effort; content fidelity is the
// contract.
export const generateDocx = async (data: ResumeContent, design?: DesignTokens) => {
    const d = design || DEFAULT_DESIGN;
    const children: Paragraph[] = [];

    const heading = (key: SectionKey) =>
        new Paragraph({ text: sectionTitle(key, d).toUpperCase(), heading: HeadingLevel.HEADING_2 });

    // Header
    children.push(
        new Paragraph({
            text: data.user?.name || "Name",
            heading: HeadingLevel.TITLE,
            alignment: d.headerStyle === 'left' ? AlignmentType.LEFT : AlignmentType.CENTER,
        }),
        new Paragraph({
            text: [data.user?.email, data.user?.phone, data.user?.location, data.user?.linkedin, data.user?.github, data.user?.website].filter(Boolean).join(" | "),
            alignment: d.headerStyle === 'left' ? AlignmentType.LEFT : AlignmentType.CENTER,
        }),
        new Paragraph({ text: "" })
    );

    const renderers: Record<SectionKey, () => void> = {
        experience: () => {
            children.push(heading('experience'));
            data.experience?.forEach((exp) => {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: exp.role || '', bold: true, size: 24 })]
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: exp.company || '', italics: true }),
                            new TextRun({ text: `  |  ${exp.startDate || ''} - ${exp.isCurrent ? 'Present' : (exp.endDate || 'Present')}`, size: 20 })
                        ]
                    }),
                );
                exp.bulletPoints?.forEach((bp) => {
                    children.push(new Paragraph({ text: `${d.bulletChar} ${bp}`, indent: { left: 400 } }));
                });
                children.push(new Paragraph({ text: "" }));
            });
        },

        education: () => {
            children.push(heading('education'));
            data.education?.forEach((edu) => {
                children.push(
                    new Paragraph({ children: [new TextRun({ text: edu.institution || '', bold: true })] }),
                    new Paragraph({ text: `${edu.degree || ''}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}${edu.gpa ? ` (GPA: ${edu.gpa})` : ''}` }),
                    new Paragraph({ text: `${edu.startDate || ''} - ${edu.endDate || ''}` }),
                );
                if (edu.coursework?.length) {
                    children.push(new Paragraph({ text: `Relevant Coursework: ${edu.coursework.join(', ')}` }));
                }
                children.push(new Paragraph({ text: "" }));
            });
        },

        skills: () => {
            children.push(heading('skills'));
            const s = data.skills;
            if (!s) return;
            ([['Languages', s.languages], ['Frameworks', s.frameworks], ['Tools', s.tools], ['Other', s.other]] as const)
                .forEach(([label, items]) => {
                    if (items?.length) {
                        children.push(new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(items.join(', '))] }));
                    }
                });
        },

        projects: () => {
            children.push(heading('projects'));
            data.projects?.forEach((proj) => {
                children.push(new Paragraph({ children: [new TextRun({ text: proj.title || '', bold: true })] }));
                if (proj.techStack?.length) {
                    children.push(new Paragraph({ children: [new TextRun({ text: `Stack: ${proj.techStack.join(', ')}`, italics: true })] }));
                }
                if (proj.description) children.push(new Paragraph({ text: proj.description }));
                proj.bulletPoints?.forEach((bp) => {
                    children.push(new Paragraph({ text: `${d.bulletChar} ${bp}`, indent: { left: 400 } }));
                });
                children.push(new Paragraph({ text: "" }));
            });
        },

        certificates: () => {
            children.push(heading('certificates'));
            data.certificates?.forEach((cert) => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: cert.name || '', bold: true }),
                        new TextRun({ text: cert.issuer ? ` - ${cert.issuer}` : '' }),
                        new TextRun({ text: cert.date ? ` (${cert.date})` : '', italics: true })
                    ]
                }));
            });
        },

        achievements: () => {
            children.push(heading('achievements'));
            data.achievements?.forEach((ach) => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: ach.title || '', bold: true }),
                        new TextRun({ text: ach.date ? ` (${ach.date})` : '', italics: true })
                    ]
                }));
                if (ach.description) children.push(new Paragraph({ text: ach.description }));
            });
        },

        publications: () => {
            children.push(heading('publications'));
            data.publications?.forEach((pub) => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: pub.title || '', bold: true }),
                        new TextRun({ text: pub.date ? ` (${pub.date})` : '', italics: true })
                    ]
                }));
                if (pub.description) children.push(new Paragraph({ text: pub.description }));
            });
        },

        volunteering: () => {
            children.push(heading('volunteering'));
            data.volunteering?.forEach((vol) => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: vol.organization || '', bold: true }),
                        new TextRun({ text: ` - ${vol.role || ''}`, italics: true }),
                        ...(vol.startDate || vol.endDate ? [new TextRun({ text: `  |  ${vol.startDate || ''} - ${vol.endDate || ''}`, size: 20 })] : [])
                    ]
                }));
                if (vol.description) children.push(new Paragraph({ text: vol.description }));
            });
        },

        patents: () => {
            children.push(heading('patents'));
            data.patents?.forEach((pat) => {
                children.push(new Paragraph({
                    children: [
                        new TextRun({ text: pat.title || '', bold: true }),
                        new TextRun({ text: pat.date ? ` (${pat.date})` : '', italics: true })
                    ]
                }));
                if (pat.number) children.push(new Paragraph({ children: [new TextRun({ text: `Patent #: ${pat.number}`, italics: true })] }));
                if (pat.description) children.push(new Paragraph({ text: pat.description }));
            });
        },

        hobbies: () => {
            children.push(heading('hobbies'));
            children.push(new Paragraph({ text: (data.hobbies || []).join(', ') }));
        },

        customSections: () => {
            data.customSections?.forEach((section) => {
                if (!section.items?.length) return;
                children.push(new Paragraph({ text: (section.title || 'Additional').toUpperCase(), heading: HeadingLevel.HEADING_2 }));
                section.items.forEach((item) => {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({ text: item.title || '', bold: true }),
                            new TextRun({ text: item.subtitle ? ` - ${item.subtitle}` : '' }),
                            new TextRun({ text: item.date ? ` (${item.date})` : '', italics: true })
                        ]
                    }));
                    if (item.description) children.push(new Paragraph({ text: item.description }));
                    item.bullets?.forEach((bp) => {
                        children.push(new Paragraph({ text: `${d.bulletChar} ${bp}`, indent: { left: 400 } }));
                    });
                });
            });
        },
    };

    for (const key of d.sectionOrder) {
        if (d.hiddenSections.includes(key)) continue;
        if (!sectionHasContent(key, data)) continue;
        renderers[key]();
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: children,
        }],
    });

    return await Packer.toBlob(doc);
};
