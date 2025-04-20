const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Путь к директории для сохранения презентаций
const outputDir = process.env.OUTPUT_DIR || './output';

// Убедиться, что директория существует
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Создает PDF презентацию на основе данных, полученных от OpenAI API
 * @param {Object} presentationData - Данные для презентации в формате JSON
 * @param {string} style - Стиль оформления презентации
 * @returns {Promise<string>} - Путь к созданному файлу
 */
async function generatePDF(presentationData, style = 'default') {
  return new Promise((resolve, reject) => {
    try {
      // Получение настроек темы
      const theme = getThemeByStyle(style);
      
      // Создаем уникальное имя файла
      const timestamp = new Date().getTime();
      const filename = `presentation_${timestamp}.pdf`;
      const outputPath = path.join(outputDir, filename);
      
      // Создаем PDF документ
      const doc = new PDFDocument({
        autoFirstPage: false,
        size: 'A4',
        layout: 'landscape',
        margin: 0,
        info: {
          Title: presentationData.title,
          Author: 'AI Presentation Generator',
          Subject: presentationData.title
        }
      });
      
      // Поток для записи файла
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Обработка каждого слайда
      for (const slide of presentationData.slides) {
        // Добавляем новую страницу (слайд)
        doc.addPage();
        
        // Настраиваем фон
        doc.rect(0, 0, doc.page.width, doc.page.height)
           .fill(`#${theme.backgroundColor}`);
        
        // Обработка в зависимости от типа слайда
        if (slide.type === 'title') {
          // Титульный слайд
          createTitleSlide(doc, slide, theme);
        } else if (slide.type === 'content') {
          // Обычный слайд с содержимым
          createContentSlide(doc, slide, theme);
        }
      }
      
      // Завершаем запись документа
      doc.end();
      
      // Возвращаем имя файла при завершении записи
      stream.on('finish', () => {
        resolve(filename);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
      
    } catch (error) {
      reject(error);
    }
  });
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
      font: 'Helvetica',
      titleSize: 36,
      subtitleSize: 24,
      headerSize: 28,
      bodySize: 16
    },
    dark: {
      backgroundColor: '2F3437',
      titleColor: 'FFFFFF',
      textColor: 'E1E1E1',
      accentColor: '3498DB',
      font: 'Helvetica',
      titleSize: 36,
      subtitleSize: 24,
      headerSize: 28,
      bodySize: 16
    },
    creative: {
      backgroundColor: 'F5F5F5',
      titleColor: '1E88E5',
      textColor: '424242',
      accentColor: 'FF5722',
      font: 'Helvetica',
      titleSize: 36,
      subtitleSize: 24,
      headerSize: 28,
      bodySize: 16
    }
  };
  
  // Возвращаем настройки для выбранного стиля или настройки по умолчанию
  return themes[style] || themes.default;
}

/**
 * Создать титульный слайд
 * @param {PDFDocument} doc - PDF документ
 * @param {Object} slideData - Данные слайда
 * @param {Object} theme - Настройки темы
 */
function createTitleSlide(doc, slideData, theme) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  
  // Добавляем заголовок
  doc.font(theme.font)
     .fontSize(theme.titleSize)
     .fill(`#${theme.titleColor}`)
     .text(slideData.title, 0, pageHeight / 2 - theme.titleSize, {
       align: 'center',
       width: pageWidth
     });
  
  // Добавляем подзаголовок, если он есть
  if (slideData.subtitle) {
    doc.font(theme.font)
       .fontSize(theme.subtitleSize)
       .fill(`#${theme.textColor}`)
       .text(slideData.subtitle, 0, pageHeight / 2 + theme.titleSize / 2, {
         align: 'center',
         width: pageWidth
       });
  }
}

/**
 * Создать слайд с содержимым
 * @param {PDFDocument} doc - PDF документ
 * @param {Object} slideData - Данные слайда
 * @param {Object} theme - Настройки темы
 */
function createContentSlide(doc, slideData, theme) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 40;
  
  // Добавляем заголовок
  doc.font(theme.font)
     .fontSize(theme.headerSize)
     .fill(`#${theme.titleColor}`)
     .text(slideData.title, margin, margin, {
       align: 'left',
       width: pageWidth - (margin * 2)
     });
  
  // Если есть маркированный список
  if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
    const startY = margin + theme.headerSize + 20;
    let currentY = startY;
    
    // Добавляем каждый пункт списка
    for (const point of slideData.bulletPoints) {
      // Добавляем маркер
      doc.circle(margin + 6, currentY + theme.bodySize / 3, 3)
         .fill(`#${theme.textColor}`);
      
      // Добавляем текст
      doc.font(theme.font)
         .fontSize(theme.bodySize)
         .fill(`#${theme.textColor}`)
         .text(point, margin + 16, currentY, {
           align: 'left',
           width: pageWidth - (margin * 2) - 16,
           continued: false
         });
      
      // Увеличиваем Y-позицию для следующего пункта
      currentY += theme.bodySize + 12;
    }
  }
  
  // Обработка визуальных элементов будет добавлена в дальнейшем
  // TODO: Добавить обработку визуальных элементов (изображения, диаграммы и т.д.)
}

module.exports = {
  generatePDF
}; 