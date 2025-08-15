import { promises as fs } from 'fs';
import path from 'path';

export interface LandingConfig {
  title: string;
  subtitle: string;
  description: string;
  bgColor: string;
  titleColor: string;
  subtitleColor: string;
  descriptionColor: string;
  links: {
    telegram: string;
    github: string;
    dev: string;
  };
}

const defaultConfig: LandingConfig = {
  title: 'Afterlight',
  subtitle: 'Идёт разработка с\u00a0помощью искусственного интеллекта',
  description: 'Скоро здесь появится серьёзный проект.',
  bgColor: '#000000',
  titleColor: '#10a37f',
  subtitleColor: '#ffffff',
  descriptionColor: '#ffffff',
  links: {
    telegram: 'https://t.me/retrotink',
    github: 'https://github.com/retrotink/afterlight',
    dev: '/dev',
  },
};

export function getLandingConfig(): LandingConfig {
  return {
    title: process.env.LANDING_TITLE || defaultConfig.title,
    subtitle: process.env.LANDING_SUBTITLE || defaultConfig.subtitle,
    description: process.env.LANDING_DESCRIPTION || defaultConfig.description,
    bgColor: process.env.LANDING_BG_COLOR || defaultConfig.bgColor,
    titleColor: process.env.LANDING_TITLE_COLOR || defaultConfig.titleColor,
    subtitleColor:
      process.env.LANDING_SUBTITLE_COLOR || defaultConfig.subtitleColor,
    descriptionColor:
      process.env.LANDING_DESCRIPTION_COLOR || defaultConfig.descriptionColor,
    links: {
      telegram: process.env.LANDING_TELEGRAM || defaultConfig.links.telegram,
      github: process.env.LANDING_GITHUB || defaultConfig.links.github,
      dev: process.env.LANDING_DEV || defaultConfig.links.dev,
    },
  };
}

export async function saveLandingConfig(config: LandingConfig): Promise<void> {
  process.env.LANDING_TITLE = config.title;
  process.env.LANDING_SUBTITLE = config.subtitle;
  process.env.LANDING_DESCRIPTION = config.description;
  process.env.LANDING_BG_COLOR = config.bgColor;
  process.env.LANDING_TITLE_COLOR = config.titleColor;
  process.env.LANDING_SUBTITLE_COLOR = config.subtitleColor;
  process.env.LANDING_DESCRIPTION_COLOR = config.descriptionColor;
  process.env.LANDING_TELEGRAM = config.links.telegram;
  process.env.LANDING_GITHUB = config.links.github;
  process.env.LANDING_DEV = config.links.dev;

  const envPath = path.join(process.cwd(), '.env.local');
  const lines = [
    `LANDING_TITLE=${config.title}`,
    `LANDING_SUBTITLE=${config.subtitle}`,
    `LANDING_DESCRIPTION=${config.description}`,
    `LANDING_BG_COLOR=${config.bgColor}`,
    `LANDING_TITLE_COLOR=${config.titleColor}`,
    `LANDING_SUBTITLE_COLOR=${config.subtitleColor}`,
    `LANDING_DESCRIPTION_COLOR=${config.descriptionColor}`,
    `LANDING_TELEGRAM=${config.links.telegram}`,
    `LANDING_GITHUB=${config.links.github}`,
    `LANDING_DEV=${config.links.dev}`,
  ];
  await fs.writeFile(envPath, lines.join('\n') + '\n', 'utf-8');
}
