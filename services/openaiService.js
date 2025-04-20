const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

dotenv.config();

// Инициализация клиента OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Простая система кэширования
const cacheDir = path.join(__dirname, '..', 'cache');
const imagesDir = path.join(__dirname, '..', 'public', 'images');

// Создаем директории, если они не существуют
[cacheDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Генерирует изображение для слайда через DALL-E API
 * @param {string} description - Описание изображения
 * @returns {Promise<string>} - Путь к сгенерированному изображению
 */
async function generateImage(description) {
  try {
    console.log('Генерация изображения для:', description);
    
    // Генерируем уникальное имя файла
    const timestamp = new Date().getTime();
    const filename = `image_${timestamp}.png`;
    const imagePath = path.join(imagesDir, filename);

    // Вызываем DALL-E API для генерации изображения
    const response = await openai.images.generate({
      model: "dall-e-2", // Используем dall-e-2 для более быстрой генерации
      prompt: description,
      n: 1,
      size: "1024x1024",
    });

    if (!response.data || response.data.length === 0) {
      console.error('Пустой ответ от DALL-E API');
      return null;
    }

    // Получаем URL изображения
    const imageUrl = response.data[0].url;
    console.log('Получен URL изображения:', imageUrl);

    // Скачиваем изображение
    const imageResponse = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'arraybuffer'
    });

    // Сохраняем изображение
    fs.writeFileSync(imagePath, imageResponse.data);
    console.log('Изображение сохранено:', imagePath);

    // Возвращаем относительный путь к изображению
    return `/images/${filename}`;
  } catch (error) {
    console.error('Ошибка при генерации изображения:', error.message);
    return null;
  }
}

/**
 * Форматирует текст, исправляя проблемы с пробелами
 * @param {string} text - Исходный текст
 * @returns {string} - Отформатированный текст
 */
function formatText(text) {
  return text
    // Добавляем пробелы между словами, написанными в CamelCase
    .replace(/([а-яёa-z])([А-ЯЁA-Z])/g, '$1 $2')
    // Исправляем множественные пробелы
    .replace(/\s+/g, ' ')
    // Убираем пробелы перед знаками препинания
    .replace(/\s+([.,!?:;])/g, '$1')
    // Добавляем пробел после знаков препинания
    .replace(/([.,!?:;])(\S)/g, '$1 $2')
    .trim();
}

/**
 * Генерирует контент для презентации на основе входных параметров
 * @param {Object} params - Параметры презентации
 * @param {string} params.theme - Тема презентации
 * @param {number} params.slideCount - Количество слайдов
 * @param {string} params.audience - Целевая аудитория
 * @param {string} params.additionalInfo - Дополнительные требования
 * @param {string} params.style - Стиль оформления
 * @returns {Promise<Object>} - Данные презентации в формате JSON
 */
async function generatePresentationContent(params) {
  try {
    const { theme, slideCount, audience, additionalInfo, style } = params;
    
    // Создаем хэш для кэширования на основе параметров
    const cacheKey = generateCacheKey(params);
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);
    
    // Проверяем наличие кэша
    if (fs.existsSync(cachePath)) {
      console.log('Используем кэшированный результат для запроса:', theme);
      const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      return cachedData;
    }
    
    // Формирование промпта для OpenAI
    const prompt = `
      Создай структуру и контент для презентации на тему "${theme}".
      Количество слайдов: ${slideCount}
      Аудитория: ${audience}
      Дополнительная информация: ${additionalInfo}
      
      Для каждого слайда укажи:
      1. Заголовок
      2. Основной текст или ключевые пункты (в виде маркированного списка)
      3. Описание необходимых визуальных элементов (графики, диаграммы, изображения)
      
      Структура презентации должна включать:
      - Титульный слайд
      - Введение/Обзор
      - Основное содержание (разбитое на логические разделы)
      - Заключение/Выводы
      
      Вывод должен быть в формате JSON.
    `;

    // Функция для выполнения запроса с повторными попытками
    let presentationData = await callWithRetry(async () => {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: 'Ты - профессиональный дизайнер презентаций. Создай структуру и контент для презентации, форматируя текст с правильными пробелами между словами.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2500,
      });

      const content = response.choices[0].message.content;
      return extractJsonFromResponse(content);
    }, 3);

    // Форматируем текст во всех слайдах
    presentationData = {
      ...presentationData,
      title: formatText(presentationData.title),
      slides: await Promise.all(presentationData.slides.map(async (slide) => {
        const formattedSlide = {
          ...slide,
          title: formatText(slide.title),
          subtitle: slide.subtitle ? formatText(slide.subtitle) : undefined,
          bulletPoints: slide.bulletPoints ? slide.bulletPoints.map(formatText) : undefined,
        };

        // Генерируем изображения для слайдов, где они нужны
        if (slide.visualElements && slide.visualElements.length > 0) {
          formattedSlide.visualElements = await Promise.all(
            slide.visualElements.map(async (element) => {
              if (element.type === 'image') {
                const imagePath = await generateImage(element.description);
                return {
                  ...element,
                  path: imagePath
                };
              }
              return element;
            })
          );
        }

        return formattedSlide;
      }))
    };
    
    // Сохраняем результат в кэш
    fs.writeFileSync(cachePath, JSON.stringify(presentationData, null, 2), 'utf-8');
    
    return presentationData;
  } catch (error) {
    console.error('Ошибка при обращении к OpenAI API:', error);
    throw new Error(`Не удалось сгенерировать контент презентации: ${error.message}`);
  }
}

/**
 * Извлекает JSON из ответа OpenAI
 * @param {string} content - Ответ от OpenAI API
 * @returns {Object} - Распарсенный JSON
 */
function extractJsonFromResponse(content) {
  try {
    // Попытка 1: Если весь контент является JSON
    try {
      return JSON.parse(content);
    } catch (e) {
      // Если не удалось, продолжаем следующие попытки
    }
    
    // Попытка 2: Ищем JSON между фигурными скобками
    const jsonMatch = content.match(/({[\s\S]*})/);
    if (jsonMatch) {
      const jsonContent = jsonMatch[0];
      try {
        return JSON.parse(jsonContent);
      } catch (e) {
        // Если не удалось, продолжаем следующие попытки
      }
    }
    
    // Попытка 3: Ищем JSON между тройными обратными кавычками
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      const jsonContent = codeBlockMatch[1];
      try {
        return JSON.parse(jsonContent);
      } catch (e) {
        // Если не удалось, продолжаем со следующими попытками
      }
    }
    
    // Если все попытки не удались, выбрасываем ошибку
    throw new Error('Не удалось извлечь валидный JSON из ответа');
  } catch (parseError) {
    console.error('Ошибка при парсинге JSON из ответа OpenAI:', parseError);
    console.error('Исходное содержимое ответа:', content);
    throw new Error('Не удалось распарсить ответ от OpenAI API');
  }
}

/**
 * Генерирует ключ для кэширования на основе параметров запроса
 * @param {Object} params - Параметры запроса
 * @returns {string} - Ключ для кэша
 */
function generateCacheKey(params) {
  const { theme, slideCount, audience } = params;
  // Создаем простой хэш, объединяя основные параметры
  const key = `${theme}_${slideCount}_${audience}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return key;
}

/**
 * Выполняет асинхронную функцию с повторными попытками в случае ошибки
 * @param {Function} fn - Асинхронная функция для выполнения
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} delay - Задержка между попытками в миллисекундах
 * @returns {Promise<any>} - Результат выполнения функции
 */
async function callWithRetry(fn, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`Попытка ${attempt}/${maxRetries} не удалась:`, error.message);
      lastError = error;
      
      if (attempt < maxRetries) {
        // Экспоненциальная задержка между попытками
        const waitTime = delay * Math.pow(2, attempt - 1);
        console.log(`Ожидание ${waitTime}мс перед следующей попыткой...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}

module.exports = {
  generatePresentationContent,
  generateImage
}; 