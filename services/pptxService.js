const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

// Путь к директории для сохранения презентаций
const outputDir = process.env.OUTPUT_DIR || './output';

// Убедиться, что директория существует
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Создает PPTX презентацию на основе данных, полученных от OpenAI API
 * @param {Object} presentationData - Данные для презентации в формате JSON
 * @param {string} style - Стиль оформления презентации
 * @returns {Promise<string>} - Путь к созданному файлу
 */
async function generatePPTX(presentationData, style = 'default') {
  try {
    // Создаем новую презентацию
    const pres = new pptxgen();
    
    // Настройка метаданных презентации
    pres.title = presentationData.title;
    pres.subject = presentationData.title;
    pres.author = 'AI Presentation Generator';
    
    // Настройка стиля в зависимости от выбранного параметра
    const theme = getThemeByStyle(style);
    applyTheme(pres, theme);
    
    // Обработка слайдов
    for (const slide of presentationData.slides) {
      // Создание слайда
      const pptxSlide = pres.addSlide();
      
      // Обработка в зависимости от типа слайда
      if (slide.type === 'title') {
        // Титульный слайд
        createTitleSlide(pptxSlide, slide, theme);
      } else if (slide.type === 'content') {
        // Обычный слайд с содержимым
        createContentSlide(pptxSlide, slide, theme);
      }
    }
    
    // Создаем уникальное имя файла
    const timestamp = new Date().getTime();
    const filename = `presentation_${timestamp}.pptx`;
    const outputPath = path.join(outputDir, filename);
    
    // Сохраняем презентацию
    await pres.writeFile({ fileName: outputPath });
    
    // Возвращаем путь к файлу
    return filename;
    
  } catch (error) {
    console.error('Ошибка при создании PPTX презентации:', error);
    throw error;
  }
}

/**
 * Получить настройки темы по стилю
 * @param {string} style - Стиль презентации
 * @returns {Object} - Настройки темы
 */
function getThemeByStyle(style) {
  // Базовые настройки тем
  const themes = {
    default: {
      backgroundColor: 'FFFFFF',
      titleColor: '333333',
      textColor: '666666',
      accentColor: '4472C4',
      font: 'Arial',
      titleSize: 44,
      subtitleSize: 32,
      headerSize: 28,
      bodySize: 18
    },
    dark: {
      backgroundColor: '2F3437',
      titleColor: 'FFFFFF',
      textColor: 'E1E1E1',
      accentColor: '3498DB',
      font: 'Calibri',
      titleSize: 44,
      subtitleSize: 32,
      headerSize: 28,
      bodySize: 18
    },
    creative: {
      backgroundColor: 'F5F5F5',
      titleColor: '1E88E5',
      textColor: '424242',
      accentColor: 'FF5722',
      font: 'Verdana',
      titleSize: 44,
      subtitleSize: 32,
      headerSize: 28,
      bodySize: 18
    }
  };
  
  // Возвращаем настройки для выбранного стиля или настройки по умолчанию
  return themes[style] || themes.default;
}

/**
 * Применить тему к презентации
 * @param {Object} pres - Объект презентации
 * @param {Object} theme - Настройки темы
 */
function applyTheme(pres, theme) {
  pres.defineSlideMaster({
    title: 'MASTER_SLIDE',
    background: { color: theme.backgroundColor },
    objects: [
      { 'rect': { x: 0, y: 0, w: '100%', h: '100%', fill: { color: theme.backgroundColor } } }
    ]
  });
}

/**
 * Создать титульный слайд
 * @param {Object} slide - Объект слайда PPTX
 * @param {Object} slideData - Данные слайда
 * @param {Object} theme - Настройки темы
 */
function createTitleSlide(slide, slideData, theme) {
  // Добавляем заголовок
  slide.addText(slideData.title, {
    x: '10%',
    y: '40%',
    w: '80%',
    fontSize: theme.titleSize,
    color: theme.titleColor,
    fontFace: theme.font,
    align: 'center',
    bold: true
  });
  
  // Добавляем подзаголовок, если он есть
  if (slideData.subtitle) {
    slide.addText(slideData.subtitle, {
      x: '10%',
      y: '55%',
      w: '80%',
      fontSize: theme.subtitleSize,
      color: theme.textColor,
      fontFace: theme.font,
      align: 'center'
    });
  }
}

/**
 * Создать слайд с содержимым
 * @param {Object} slide - Объект слайда PPTX
 * @param {Object} slideData - Данные слайда
 * @param {Object} theme - Настройки темы
 */
function createContentSlide(slide, slideData, theme) {
  // Добавляем заголовок
  slide.addText(slideData.title, {
    x: '5%',
    y: '5%',
    w: '90%',
    h: '10%',
    fontSize: theme.headerSize,
    color: theme.titleColor,
    fontFace: theme.font,
    bold: true
  });
  
  // Если есть маркированный список
  if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
    // Преобразуем массив пунктов в текст с маркерами
    const bulletTextLines = slideData.bulletPoints.map(point => ({ text: point }));
    
    slide.addText(bulletTextLines, {
      x: '5%',
      y: '20%',
      w: '90%',
      h: '60%',
      fontSize: theme.bodySize,
      color: theme.textColor,
      fontFace: theme.font,
      bullet: { type: 'bullet' }
    });
  }
  
  // Обработка визуальных элементов будет добавлена в дальнейшем
  // TODO: Добавить обработку визуальных элементов (изображения, диаграммы и т.д.)
}

module.exports = {
  generatePPTX
}; 