import { promises as fs } from 'fs';
import path from 'path';

export interface LandingConfig {
  title: string;
  subtitle: string;
  description: string;
  bgColor: string;
  headerBgColor: string;
  headerTextColor: string;
  titleColor: string;
  subtitleColor: string;
  descriptionColor: string;
  buttonPrimaryBgColor: string;
  buttonPrimaryTextColor: string;
  buttonSecondaryBorderColor: string;
  buttonSecondaryTextColor: string;
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
  headerBgColor: '#f3f4f6',
  headerTextColor: '#111827',
  titleColor: '#10a37f',
  subtitleColor: '#ffffff',
  descriptionColor: '#ffffff',
  buttonPrimaryBgColor: '#2563eb',
  buttonPrimaryTextColor: '#ffffff',
  buttonSecondaryBorderColor: '#2563eb',
  buttonSecondaryTextColor: '#2563eb',
  links: {
    telegram: 'https://t.me/retrotink',
    github: 'https://github.com/retrotink/afterlight',
    // route for development layout
    dev: '/',
  },
};

export function getLandingConfig(): LandingConfig {
  return {
    title: process.env.LANDING_TITLE || defaultConfig.title,
    subtitle: process.env.LANDING_SUBTITLE || defaultConfig.subtitle,
    description: process.env.LANDING_DESCRIPTION || defaultConfig.description,
    bgColor: process.env.LANDING_BG_COLOR || defaultConfig.bgColor,
    headerBgColor:
      process.env.LANDING_HEADER_BG_COLOR || defaultConfig.headerBgColor,
    headerTextColor:
      process.env.LANDING_HEADER_TEXT_COLOR || defaultConfig.headerTextColor,
    titleColor: process.env.LANDING_TITLE_COLOR || defaultConfig.titleColor,
    subtitleColor:
      process.env.LANDING_SUBTITLE_COLOR || defaultConfig.subtitleColor,
    descriptionColor:
      process.env.LANDING_DESCRIPTION_COLOR || defaultConfig.descriptionColor,
    buttonPrimaryBgColor:
      process.env.LANDING_BUTTON_PRIMARY_BG_COLOR ||
      defaultConfig.buttonPrimaryBgColor,
    buttonPrimaryTextColor:
      process.env.LANDING_BUTTON_PRIMARY_TEXT_COLOR ||
      defaultConfig.buttonPrimaryTextColor,
    buttonSecondaryBorderColor:
      process.env.LANDING_BUTTON_SECONDARY_BORDER_COLOR ||
      defaultConfig.buttonSecondaryBorderColor,
    buttonSecondaryTextColor:
      process.env.LANDING_BUTTON_SECONDARY_TEXT_COLOR ||
      defaultConfig.buttonSecondaryTextColor,
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
  process.env.LANDING_HEADER_BG_COLOR = config.headerBgColor;
  process.env.LANDING_HEADER_TEXT_COLOR = config.headerTextColor;
  process.env.LANDING_TITLE_COLOR = config.titleColor;
  process.env.LANDING_SUBTITLE_COLOR = config.subtitleColor;
  process.env.LANDING_DESCRIPTION_COLOR = config.descriptionColor;
  process.env.LANDING_BUTTON_PRIMARY_BG_COLOR = config.buttonPrimaryBgColor;
  process.env.LANDING_BUTTON_PRIMARY_TEXT_COLOR = config.buttonPrimaryTextColor;
  process.env.LANDING_BUTTON_SECONDARY_BORDER_COLOR =
    config.buttonSecondaryBorderColor;
  process.env.LANDING_BUTTON_SECONDARY_TEXT_COLOR =
    config.buttonSecondaryTextColor;
  process.env.LANDING_TELEGRAM = config.links.telegram;
  process.env.LANDING_GITHUB = config.links.github;
  process.env.LANDING_DEV = config.links.dev;

  const envPath = path.join(process.cwd(), '.env.local');
  const lines = [
    `LANDING_TITLE=${config.title}`,
    `LANDING_SUBTITLE=${config.subtitle}`,
    `LANDING_DESCRIPTION=${config.description}`,
    `LANDING_BG_COLOR=${config.bgColor}`,
    `LANDING_HEADER_BG_COLOR=${config.headerBgColor}`,
    `LANDING_HEADER_TEXT_COLOR=${config.headerTextColor}`,
    `LANDING_TITLE_COLOR=${config.titleColor}`,
    `LANDING_SUBTITLE_COLOR=${config.subtitleColor}`,
    `LANDING_DESCRIPTION_COLOR=${config.descriptionColor}`,
    `LANDING_BUTTON_PRIMARY_BG_COLOR=${config.buttonPrimaryBgColor}`,
    `LANDING_BUTTON_PRIMARY_TEXT_COLOR=${config.buttonPrimaryTextColor}`,
    `LANDING_BUTTON_SECONDARY_BORDER_COLOR=${config.buttonSecondaryBorderColor}`,
    `LANDING_BUTTON_SECONDARY_TEXT_COLOR=${config.buttonSecondaryTextColor}`,
    `LANDING_TELEGRAM=${config.links.telegram}`,
    `LANDING_GITHUB=${config.links.github}`,
    `LANDING_DEV=${config.links.dev}`,
  ];
  await fs.writeFile(envPath, lines.join('\n') + '\n', 'utf-8');
}
