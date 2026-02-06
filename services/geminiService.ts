/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GeneratedScene } from '../components/Step3SceneGeneration';
import { Language } from "../lib/i18n";

interface InlineData {
    mimeType: string;
    data: string;
}

interface Part {
    text?: string;
    inlineData?: InlineData;
}

const TEXT_API_BASE = import.meta.env.VITE_LOCAL_TEXT_API_BASE || 'http://localhost:8000';
const IMAGE_API_BASE = import.meta.env.VITE_LOCAL_IMAGE_API_BASE || 'http://localhost:8001';
const TEXT_MODEL = import.meta.env.VITE_LOCAL_TEXT_MODEL || 'qwen2.5-72b-instruct';
const VISION_MODEL = import.meta.env.VITE_LOCAL_VISION_MODEL || TEXT_MODEL;
const IMAGE_MODEL = import.meta.env.VITE_LOCAL_IMAGE_MODEL || 'qwen-image-edit';
const LOCAL_API_KEY = import.meta.env.VITE_LOCAL_API_KEY;

const DEFAULT_IMAGE_MIME = 'image/png';

const AUTH_HEADERS = LOCAL_API_KEY
    ? { Authorization: `Bearer ${LOCAL_API_KEY}` }
    : {};

function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteString = atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const intArray = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i += 1) {
        intArray[i] = byteString.charCodeAt(i);
    }
    return new Blob([intArray], { type: mimeType });
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch generated image from ${url}.`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function callLocalChatCompletion(options: {
    prompt: string;
    images?: InlineData[];
    model?: string;
}): Promise<string> {
    const { prompt, images = [], model = TEXT_MODEL } = options;
    const content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: prompt }
    ];

    images.forEach(image => {
        content.push({
            type: 'image_url',
            image_url: { url: `data:${image.mimeType};base64,${image.data}` }
        });
    });

    const body = {
        model,
        messages: [{ role: 'user', content }],
        temperature: 0.4
    };

    const response = await fetch(`${TEXT_API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...AUTH_HEADERS
        },
        body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok) {
        const message = payload?.error?.message || `Local text model request failed with status ${response.status}.`;
        throw new Error(message);
    }

    const text = payload?.choices?.[0]?.message?.content?.trim();
    if (!text) {
        throw new Error('Local text model did not return any content.');
    }

    return text;
}

async function callLocalImageModel(options: {
    prompt: string;
    baseImage?: InlineData;
    maskImage?: InlineData;
    referenceImage?: InlineData;
}): Promise<string> {
    const { prompt, baseImage, maskImage, referenceImage } = options;
    const endpoint = baseImage ? `${IMAGE_API_BASE}/v1/images/edits` : `${IMAGE_API_BASE}/v1/images/generations`;

    let response: Response;

    if (baseImage) {
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('model', IMAGE_MODEL);
        formData.append('n', '1');
        formData.append('response_format', 'b64_json');
        formData.append('image', base64ToBlob(baseImage.data, baseImage.mimeType), 'base-image.png');

        if (maskImage) {
            formData.append('mask', base64ToBlob(maskImage.data, maskImage.mimeType), 'mask-image.png');
        }

        if (referenceImage) {
            formData.append('reference_image', base64ToBlob(referenceImage.data, referenceImage.mimeType), 'reference-image.png');
        }

        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                ...AUTH_HEADERS
            },
            body: formData
        });
    } else {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...AUTH_HEADERS
            },
            body: JSON.stringify({
                prompt,
                model: IMAGE_MODEL,
                n: 1,
                response_format: 'b64_json'
            })
        });
    }

    const payload = await response.json();
    if (!response.ok) {
        const message = payload?.error?.message || `Local image model request failed with status ${response.status}.`;
        throw new Error(message);
    }

    const data = payload?.data?.[0];
    if (data?.b64_json) {
        return `data:image/png;base64,${data.b64_json}`;
    }

    if (data?.url) {
        return await fetchImageAsDataUrl(data.url);
    }

    if (payload?.image?.b64_json) {
        return `data:image/png;base64,${payload.image.b64_json}`;
    }

    throw new Error('Local image model did not return image data.');
}

function getFallbackPrompt(decade: string): string {
    return `Create a photograph of the person in this image as if they were living in the ${decade}. The photograph should capture the distinct fashion, hairstyles, and overall atmosphere of that time period. Ensure the final image is a clear photograph that looks authentic to the era.`;
}

function extractDecade(prompt: string): string | null {
    const match = prompt.match(/(\d{4}s)/);
    return match ? match[1] : null;
}

export async function imageSrcToBase64(src: string): Promise<string> {
    const match = src.match(/^data:image\/\w+;base64,(.*)$/);
    if (match) {
        return match[1];
    }

    try {
        const response = await fetch(src);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting image to base64:", error);
        throw error;
    }
}

async function imageSrcToInlineData(src: string): Promise<InlineData> {
    const match = src.match(/^data:(image\/\w+);base64,(.*)$/);
    if (match) {
        return { mimeType: match[1], data: match[2] };
    }

    const response = await fetch(src);
    const blob = await response.blob();
    const mimeType = blob.type || DEFAULT_IMAGE_MIME;
    const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    return { mimeType, data };
}

function generatePromptVariations(basePrompt: string): string {
    const variations = [
        '',
        '. Please generate a unique result.',
        '; make it distinctive.',
        '! Create something fresh.',
        ' - ensure originality.',
        '? Make it stand out.',
        ': focus on uniqueness.'
    ];
    const randomVariation = variations[Math.floor(Math.random() * variations.length)];
    const timestamp = Date.now();
    return basePrompt + randomVariation + ` [${timestamp}]`;
}

export async function generateArchitecturalImage(options: {
    prompt: string;
    baseImage?: InlineData;
    maskImage?: InlineData;
    referenceImage?: InlineData;
}): Promise<string> {
    const { prompt, baseImage, maskImage, referenceImage } = options;
    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            return await callLocalImageModel({ prompt, baseImage, maskImage, referenceImage });
        } catch (error) {
            attempts += 1;
            console.error(`Attempt ${attempts} failed:`, error);

            if (attempts >= maxAttempts) {
                throw new Error(`Local image generation failed after ${maxAttempts} attempts. Last error: ${error instanceof Error ? error.message : String(error)}`);
            }

            const backoffTime = Math.min(Math.pow(2, attempts) * 500, 8000);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
    }

    throw new Error('Local image generation failed after all attempts.');
}

export async function generateAIRendering(
    baseImageSrc: string,
    promptOverride?: string,
    maskBase64?: string,
    numberOfImages: number = 1
): Promise<string[]> {
    const baseImage = await imageSrcToInlineData(baseImageSrc);

    const generationPromises: Promise<string>[] = [];

    for (let i = 0; i < numberOfImages; i += 1) {
        const promise = (async () => {
            let prompt: string;
            let maskImage: InlineData | undefined;

            if (maskBase64) {
                prompt = generatePromptVariations(`Using the provided black and white mask image, make precise modifications to the base image, which is an architectural top-down view. Apply the following changes: "${promptOverride}"

PERSPECTIVE INSTRUCTIONS:
- The base image is a TOP-DOWN ARCHITECTURAL VIEW (bird's-eye view).
- Any objects you add or modify (like furniture, windows, doors) MUST be rendered from a consistent TOP-DOWN perspective.
- DO NOT generate side-view or isometric-view objects. All elements must look as they would in a standard architectural floor plan rendering.

MASKING INSTRUCTIONS:
- You MUST only modify the areas of the base image that correspond to the WHITE regions in the mask.
- The BLACK areas of the mask indicate parts of the base image that MUST be preserved exactly as they are.
- Ensure the final image is a single, coherent photograph with seamless blending between the edited and unedited parts.
- Do not include the mask itself in the final output.

QUALITY REQUIREMENTS:
- Maintain the original lighting, style, and perspective.
- Ensure the edits are photorealistic and high-quality.`);
                maskImage = { mimeType: DEFAULT_IMAGE_MIME, data: maskBase64 };
            } else {
                const defaultPrompt = `Transform this 2D architectural floor plan into a precise, high-quality 3D rendered top-down view with the following requirements:

CLEANING REQUIREMENTS:
- COMPLETELY REMOVE all text, Chinese characters, numbers, dimension markings, labels, room names, symbols that are not part of the architecture, and human figures.
- Remove all annotations, measurements, and written descriptions.
- Eliminate any logos, watermarks, or copyright notices.

SYMBOL INTERPRETATION:
- A rectangle containing vertical lines (representing hanging clothes) is a wardrobe (衣櫃). Render this as a built-in closet or wardrobe.
- A rectangle with a large 'X' drawn through it is a storage cabinet (收納櫃). Render this as a generic built-in storage unit.

ARCHITECTURAL PRECISION:
- Maintain exact wall positions, thicknesses, and openings from the original plan.
- Preserve accurate door and window locations and sizes.
- Keep precise room proportions and spatial relationships.
- Maintain correct corridor widths.

VISUAL ENHANCEMENT:
- Add realistic architectural materials (concrete walls, tile/wood flooring, proper ceiling finishes).
- Apply appropriate lighting with natural shadows.
- Use a neutral, professional color palette.
- Ensure clean, crisp edges and professional presentation.

IMPORTANT: Generate a clean, professional architectural visualization that accurately represents the spatial layout while removing all textual elements and correctly interpreting the specified architectural symbols.`;

                prompt = generatePromptVariations(promptOverride || defaultPrompt);
            }

            return await generateArchitecturalImage({
                prompt,
                baseImage,
                maskImage
            });
        })();
        generationPromises.push(promise);
    }

    return await Promise.all(generationPromises);
}

export async function generateInteriorScene(
    planImageSrc: string,
    pointX: number,
    pointY: number,
    style: string,
    viewIndex: number,
    camera: { rotation: number; tilt: number; zoom: number; },
    mode: 'day' | 'night',
    temperature: number
): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = planImageSrc;
    });

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const radius = 25;

    ctx.beginPath();
    ctx.arc(pointX, pointY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(viewIndex.toString(), pointX, pointY);

    const imageWithPointBase64 = canvas.toDataURL().split(',')[1];

    let cameraInstructions = '';
    if (camera) {
        if (camera.rotation !== 0) {
            const direction = camera.rotation > 0 ? 'right' : 'left';
            cameraInstructions += ` The camera is panned ${Math.abs(camera.rotation)} degrees to the ${direction}.`;
        }

        if (camera.tilt !== 0) {
            const direction = camera.tilt > 0 ? 'upwards' : 'downwards';
            cameraInstructions += ` The camera is tilted ${Math.abs(camera.tilt)} degrees ${direction}.`;
        }

        if (camera.zoom > 1) {
            cameraInstructions += ` The view is zoomed in.`;
        } else if (camera.zoom < 1) {
            cameraInstructions += ` The view is zoomed out for a wider angle.`;
        }
    }

    const materialRealism = 'photorealistic with hyper-detailed textures';

    const lightingDescription = mode === 'day'
        ? `a bright, naturally lit daytime scene from large windows, with a neutral-to-cool color temperature of around ${temperature}K`
        : `a dramatic and atmospheric nighttime scene. The primary light source MUST be artificial interior lighting (lamps, recessed lights). Create high contrast between the warm, bright lights and deep, dark shadows. If there are windows, they MUST show a dark night sky outside. The overall mood should be cozy and well-lit, with a color temperature of around ${temperature}K`;

    const promptDetails = [
        `Generate a ${materialRealism} FIRST-PERSON VIEW interior photograph from the perspective of viewpoint ${viewIndex} on the attached floor plan.`,
        `STYLE & ATMOSPHERE: The interior design style is "${style}".`,
        `LIGHTING: ${lightingDescription}. Render realistic shadows, reflections, and highlights corresponding to this light source.`,
        `CAMERA VIEW: The camera is at human eye-level (approximately 1.6 meters high).${cameraInstructions || ' The camera is at a neutral, forward-facing position.'}`,
        'COMPOSITION: Create a complete and believable indoor scene with walls, ceiling, floor, furniture, and decor that fit the specified style. The layout must be consistent with the floor plan.',
        `CRITICAL INSTRUCTIONS: The output MUST be a ground-level, horizontal photograph from inside the room. ABSOLUTELY DO NOT generate aerial, top-down, or bird's-eye perspectives. The image must look like it was taken by a person standing at viewpoint ${viewIndex}.`
    ];

    const basePrompt = promptDetails.join(' ');
    const prompt = generatePromptVariations(basePrompt);

    return await generateArchitecturalImage({
        prompt,
        baseImage: { mimeType: DEFAULT_IMAGE_MIME, data: imageWithPointBase64 }
    });
}

export async function editInteriorScene(
    baseImageSrc: string,
    prompt: string,
    mode: 'day' | 'night',
    temperature: number,
    maskBase64?: string,
    objectImageBase64?: string
): Promise<string> {
    const baseImage = await imageSrcToInlineData(baseImageSrc);

    const lightingDescription = mode === 'day'
        ? `a bright, naturally lit daytime scene from large windows, with a neutral-to-cool color temperature of around ${temperature}K`
        : `a dramatic and atmospheric nighttime scene. The primary light source MUST be artificial interior lighting (lamps, recessed lights). Create high contrast between the warm, bright lights and deep, dark shadows. If there are windows, they MUST show a dark night sky outside. The overall mood should be cozy and well-lit, with a color temperature of around ${temperature}K`;

    let editPromptText: string;
    let maskImage: InlineData | undefined;
    let referenceImage: InlineData | undefined;

    const commonInstructions = `
CRITICAL INSTRUCTIONS:
-   Maintain the original camera angle, perspective, and overall architectural structure.
-   The result must be a single, photorealistic, and coherent image with seamless blending.
-   Do not include the mask or reference object image in the final output.
-   The output must be a ground-level photograph. DO NOT change to a top-down or bird's-eye view.
-   Match the style, lighting, shadows, and perspective of the base scene for any new objects.`;

    if (objectImageBase64) {
        referenceImage = { mimeType: DEFAULT_IMAGE_MIME, data: objectImageBase64 };

        if (maskBase64) {
            editPromptText = `You are an expert interior photo editor. You are given a BASE SCENE image, a reference OBJECT image, and a MASK image.
TASK:
1.  **PLACE OBJECT IN MASKED AREA:** Place the object from the OBJECT image into the white area defined by the MASK on the BASE SCENE.
2.  **USE PROMPT FOR GUIDANCE:** The user's instruction for placement is: "${prompt}".
3.  **ADJUST LIGHTING:** Render the entire scene as ${lightingDescription}.
4.  **PRESERVE UNMASKED AREA:** The black area of the mask MUST remain unchanged.
${commonInstructions}`;
            maskImage = { mimeType: DEFAULT_IMAGE_MIME, data: maskBase64 };
        } else {
            editPromptText = `You are an expert interior photo editor. You are given a BASE SCENE image and a reference OBJECT image.
TASK:
1.  **ADD OBJECT TO SCENE:** Seamlessly integrate the object from the OBJECT image into the BASE SCENE.
2.  **USE PROMPT FOR PLACEMENT:** The user's instruction for placement is: "${prompt}".
3.  **ADJUST LIGHTING:** Render the entire scene as ${lightingDescription}.
${commonInstructions}`;
        }
    } else if (maskBase64) {
        editPromptText = `You are an expert interior photo editor. Using the provided mask, modify ONLY the masked area of the image based on the user's request, and adjust the overall lighting.
TASK:
1.  **APPLY EDIT TO MASKED AREA:** Make the following change ONLY in the white area defined by the mask: "${prompt}".
2.  **ADJUST LIGHTING:** Render the entire scene as ${lightingDescription}.
3.  **PRESERVE UNMASKED AREA:** The black area of the mask MUST remain unchanged.
${commonInstructions}`;
        maskImage = { mimeType: DEFAULT_IMAGE_MIME, data: maskBase64 };
    } else {
        editPromptText = `You are an expert interior photo editor. Modify the image based on the user's request and adjust the lighting.
TASK:
1.  **APPLY EDIT:** Make the following change: "${prompt || 'No specific edit, just apply lighting changes.'}".
2.  **ADJUST LIGHTING:** Render the scene as ${lightingDescription}.
${commonInstructions}`;
    }

    return await generateArchitecturalImage({
        prompt: generatePromptVariations(editPromptText),
        baseImage,
        maskImage,
        referenceImage
    });
}

export async function generateDecadeImage(imageDataUrl: string, prompt: string): Promise<string> {
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error("Invalid image data URL format. Expected 'data:image/...;base64,...'");
    }
    const [, mimeType, base64Data] = match;

    const baseImage = { mimeType, data: base64Data };

    try {
        return await generateArchitecturalImage({
            prompt: generatePromptVariations(prompt),
            baseImage
        });
    } catch (error) {
        const decade = extractDecade(prompt);
        if (!decade) {
            throw error;
        }

        const fallbackPrompt = getFallbackPrompt(decade);
        return await generateArchitecturalImage({
            prompt: generatePromptVariations(fallbackPrompt),
            baseImage
        });
    }
}

export async function suggestInteriorStyle(planImageSrc: string): Promise<string> {
    const planImage = await imageSrcToInlineData(planImageSrc);

    const prompt = `Analyze this architectural floor plan. Based on the layout, room sizes, and potential flow, suggest a single, concise interior design style that would be suitable. Provide only the name of the style (e.g., "Modern Minimalist", "Scandinavian", "Industrial Loft", "Bohemian Chic"). Do not add any other explanatory text.`;

    const response = await callLocalChatCompletion({
        prompt,
        images: [planImage],
        model: VISION_MODEL
    });

    const suggestedStyle = response.trim();
    if (!suggestedStyle) {
        throw new Error('Local model did not return a style suggestion.');
    }

    return suggestedStyle.split('\n')[0];
}

export interface PresentationText {
    presentationTitle: string;
    conceptTitle: string;
    mainConcepts: string[];
    viewpointDetails: {
        title: string;
        description: string;
    }[];
    conclusionTitle: string;
    conclusion: string;
}

export async function generatePresentationText(
    planImageSrc: string,
    scenes: GeneratedScene[],
    style: string,
    language: Language
): Promise<PresentationText> {
    const planImage = await imageSrcToInlineData(planImageSrc);
    const sceneImages = await Promise.all(
        scenes
            .filter(scene => scene.url)
            .map(scene => imageSrcToInlineData(scene.url))
    );

    const languageInstruction = language === 'zh' ? 'Traditional Chinese (Taiwan)' : 'English';

    const prompt = `You are an expert interior designer creating a client-facing presentation in ${languageInstruction}.

The provided design style is "${style}". Your primary task is to generate all text content for the presentation.

**CRITICAL INSTRUCTIONS:**
1.  **Language:** The entire JSON output MUST be in ${languageInstruction}. If the provided style name "${style}" is not in this language, you MUST translate it. There should be no mixed languages in the output.
2.  **Brevity:** Be concise. Adhere strictly to the following length limits to ensure text fits on the slides.
    - **presentationTitle**: A creative title, max 10 words.
    - **conceptTitle**: A title for the main concepts slide, max 7 words.
    - **mainConcepts**: Exactly 4 concepts. Each string should be "Title: Description", max 15 words total per string.
    - **viewpointDetails.title**: A short room name or summary, max 7 words.
    - **viewpointDetails.description**: A detailed description, max 30 words.
    - **conclusionTitle**: A title for the conclusion slide, max 7 words.
    - **conclusion**: A concluding paragraph, max 40 words.

Analyze the provided floor plan and ${sceneImages.length} viewpoint images, then generate a JSON object that follows the provided schema.`;

    const response = await callLocalChatCompletion({
        prompt,
        images: [planImage, ...sceneImages],
        model: VISION_MODEL
    });

    try {
        return JSON.parse(response) as PresentationText;
    } catch (error) {
        throw new Error(`Failed to parse presentation JSON from local model. ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function suggestPlanImprovements(planImageSrc: string): Promise<string> {
    const planImage = await imageSrcToInlineData(planImageSrc);

    const prompt = `Analyze this rendered architectural floor plan. Provide one concise, actionable suggestion for improvement that could be passed to an AI image editor. The suggestion should be a single sentence. Examples: "Add a kitchen island for more counter space.", "Convert the small bedroom into a home office.", "Create an open-plan living area by removing the wall between the kitchen and living room." Focus on architectural or significant furniture layout changes. Do not add any conversational text, just the suggestion itself.`;

    const response = await callLocalChatCompletion({
        prompt,
        images: [planImage],
        model: VISION_MODEL
    });

    const suggestion = response.trim();
    if (!suggestion) {
        throw new Error('Local model did not return a suggestion.');
    }

    return suggestion;
}

export async function suggestStyleIdeas(): Promise<string[]> {
    try {
        const response = await callLocalChatCompletion({
            prompt: 'Suggest 6 diverse and popular interior design styles. Provide only the names of the styles in a JSON array.'
        });

        const styles = JSON.parse(response);
        if (!Array.isArray(styles) || styles.length === 0) {
            throw new Error('Local model did not return a valid array of style suggestions.');
        }

        return styles.slice(0, 6);
    } catch (error) {
        console.error("Error suggesting style ideas:", error);
        return ['Modern Minimalist', 'Scandinavian', 'Industrial Loft', 'Bohemian Chic', 'Coastal', 'Japanese Zen'];
    }
}

export type { Part };
