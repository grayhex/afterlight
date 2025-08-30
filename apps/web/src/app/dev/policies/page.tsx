import fs from 'fs';
import path from 'path';
import React from 'react';

function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let list: React.ReactNode[] | null = null;

  lines.forEach((line, idx) => {
    if (line.startsWith('# ')) {
      if (list) {
        elements.push(<ul key={`ul-${idx}`}>{list}</ul>);
        list = null;
      }
      elements.push(
        <h2 key={`h1-${idx}`} className="text-xl font-semibold">
          {line.replace('# ', '')}
        </h2>
      );
    } else if (/^\d+\.\s/.test(line)) {
      if (list) {
        elements.push(<ul key={`ul-${idx}`}>{list}</ul>);
        list = null;
      }
      const id = line.match(/^\d+/)?.[0] || `${idx}`;
      elements.push(
        <h3 key={`h2-${idx}`} id={`section-${id}`} className="mt-4 font-medium">
          {line}
        </h3>
      );
    } else if (line.startsWith('- ')) {
      list = list || [];
      list.push(<li key={`li-${idx}`}>{line.replace('- ', '')}</li>);
    } else if (line.trim() === '') {
      if (list) {
        elements.push(<ul key={`ul-${idx}`}>{list}</ul>);
        list = null;
      } else {
        elements.push(<p key={`p-${idx}`} className="mt-2"></p>);
      }
    } else {
      if (list) {
        elements.push(<ul key={`ul-${idx}`}>{list}</ul>);
        list = null;
      }
      elements.push(<p key={`p-${idx}`}>{line}</p>);
    }
  });

  if (list) {
    elements.push(<ul key="ul-end">{list}</ul>);
  }

  return elements;
}

export default function PoliciesPage() {
  // Resolve docs directory from repository root instead of app root
  const base = path.resolve(process.cwd(), '..', '..', 'docs', 'policies');
  const terms = fs.readFileSync(path.join(base, 'Terms-draft-RU.md'), 'utf-8');
  const privacy = fs.readFileSync(
    path.join(base, 'PrivacyPolicy-draft-RU.md'),
    'utf-8'
  );

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Политики</h1>
      <nav className="my-4">
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <a href="#terms">Пользовательское соглашение</a>
          </li>
          <li>
            <a href="#privacy">Политика конфиденциальности</a>
          </li>
        </ul>
      </nav>
      <section id="terms" className="space-y-2">
        {renderMarkdown(terms)}
      </section>
      <section id="privacy" className="space-y-2">
        {renderMarkdown(privacy)}
      </section>
    </div>
  );
}
