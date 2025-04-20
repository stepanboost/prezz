const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Импорт сервисов
const openaiService = require('../services/openaiService');
const pptxService = require('../services/pptxService');
const pdfService = require('../services/pdfService');

// Путь к директории для сохранения презентаций
const outputDir = process.env.OUTPUT_DIR || './output';

/**
 * Маршрут для генерации презентации
 * POST /api/presentation/generate
 */
router.post('/generate', async (req, res) => {
  try {
    // Получаем параметры из запроса
    const { theme, slideCount, audience, additionalInfo, style, format } = req.body;
    
    // Проверка наличия обязательных параметров
    if (!theme) {
      return res.status(400).json({ error: 'Тема презентации обязательна' });
    }
    
    // Логирование запроса
    console.log(`Получен запрос на генерацию презентации на тему: ${theme}`);
    
    // Подготовка параметров
    const params = {
      theme,
      slideCount: slideCount || 10,
      audience: audience || 'Общая аудитория',
      additionalInfo: additionalInfo || '',
      style: style || 'default'
    };
    
    // Генерация контента с использованием OpenAI API
    const presentationData = await openaiService.generatePresentationContent(params);
    
    let filename;
    // Экспорт презентации в выбранный формат
    if (format === 'pdf') {
      filename = await pdfService.generatePDF(presentationData, params.style);
    } else {
      // По умолчанию PPTX
      filename = await pptxService.generatePPTX(presentationData, params.style);
    }
    
    // Формирование URL для скачивания
    const downloadUrl = `/api/presentation/download/${filename}`;
    
    // Отправка ответа
    res.json({
      success: true,
      message: 'Презентация успешно создана',
      downloadUrl,
      presentationTitle: presentationData.title
    });
    
  } catch (error) {
    console.error('Ошибка при генерации презентации:', error);
    res.status(500).json({
      error: 'Произошла ошибка при создании презентации',
      details: error.message
    });
  }
});

/**
 * Маршрут для скачивания презентации
 * GET /api/presentation/download/:filename
 */
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(outputDir, filename);
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    // Определяем MIME-тип на основе расширения файла
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    
    // Отправка файла
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Ошибка при скачивании презентации:', error);
    res.status(500).json({
      error: 'Произошла ошибка при скачивании презентации',
      details: error.message
    });
  }
});

module.exports = router; 