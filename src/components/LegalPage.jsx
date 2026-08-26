import React from "react";


export default function LegalPage({ title, effectiveDate, sections = [] }) {
  return (
    <div className="h-screen w-full overflow-y-auto bg-white font-sans text-black antialiased custom-scrollbar">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-black">
            {title}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Effective Date: {effectiveDate}
          </p>
        </header>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="mb-3 text-lg font-semibold text-black">
                {section.heading}
              </h2>
              {section.paragraphs?.length > 0 && (
                <div className="space-y-3">
                  {section.paragraphs.map((paragraph, i) => (
                    <p
                      key={i}
                      className="text-[15px] leading-relaxed text-neutral-800"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
              {section.items?.length > 0 && (
                <ul className="space-y-3">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-[15px] leading-relaxed text-neutral-800"
                    >
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-16 border-t border-neutral-200 pt-6">
          <p className="text-sm text-neutral-500">
            Questions? Contact the Spire team at{" "}
            <a
              href="mailto:lucirox289@gmail.com"
              className="text-neutral-900 underline underline-offset-2"
            >
              lucirox289@gmail.com
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}