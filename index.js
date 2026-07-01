#!/usr/bin/env node
// ============================================
// 易象乾坤 · 六爻排盘 MCP 服务
// 支持 stdio 和 SSE 两种传输模式
// ============================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import cors from 'cors';

// ============ 工具定义 ============
const TOOLS = [
    {
        name: 'liuyao_divination',
        description: `【MCP 工具】六爻排盘占卜，基于火珠林法和《增删卜易》体系，提供专业的六爻排盘和智能解读。

【触发条件 - 何时调用】
当用户明确表达占卜、算命、算卦、测运势等意图时，应调用此工具。
识别关键词：测、算、占、卜、卦、运势、吉凶、摇卦、排盘。

典型用户表达：
- "帮我测一下财运"、"测感情发展"
- "算一卦"、"摇个卦看看"
- "我最近的运势怎么样"、"这个事情会顺利吗"
- "帮我排个盘"、"起一卦看看"

【不适用场景 - 何时不调用】
- 用户只是闲聊、问路、查询信息等非占卜请求
- 用户要求的是科学预测（如天气、股票走势分析）
- 用户没有明确表达占卜意图，只是随口一提

【智能性别询问规则】
- 当问题涉及感情、婚姻、恋爱、桃花时，AI 必须先询问用户性别
- 如果用户已主动说明性别，直接调用，无需重复询问
- 其他情况（财运、事业、学业、工作、官司、出行、失物、风水、健康等）无需询问性别

【调用参数说明】
- question（必填）：用户所求问的事情
- method（可选）：起卦方式，默认 auto（自动摇卦）
- gender（可选）：用户性别，感情类必填，其他可选
- lines（可选）：手动输入六爻结果，1=阳，0=阴
- old_lines（可选）：手动输入动爻标记，1=动，0=静`,
        inputSchema: {
            type: 'object',
            properties: {
                question: {
                    type: 'string',
                    description: '用户所求问的事情，如"测财运"、"问感情发展"'
                },
                method: {
                    type: 'string',
                    enum: ['auto', 'manual'],
                    description: '起卦方式：auto=系统自动摇卦，manual=用户手动输入爻象',
                    default: 'auto'
                },
                lines: {
                    type: 'array',
                    description: '六次摇卦结果，1=阳爻，0=阴爻，从初爻到上爻',
                    minItems: 6,
                    maxItems: 6,
                    items: { type: 'integer', enum: [0, 1] }
                },
                old_lines: {
                    type: 'array',
                    description: '六次摇卦的动爻标记，1=动爻，0=静爻',
                    minItems: 6,
                    maxItems: 6,
                    items: { type: 'integer', enum: [0, 1] }
                },
                manual_lines: {
                    type: 'array',
                    description: '手动输入模式时的爻象描述，如 ["阳","阴","老阳","老阴","阳","阴"]',
                    items: { type: 'string' }
                },
                gender: {
                    type: 'string',
                    enum: ['male', 'female'],
                    description: '用户性别（感情类问题必填）'
                }
            },
            required: ['question']
        }
    }
];

// ============ 需要问性别的关键词 ============
const GENDER_REQUIRED_KEYWORDS = [
    '感情', '爱情', '恋爱', '桃花', '姻缘',
    '婚姻', '结婚', '伴侣', '对象', '恋人',
    '女友', '男友', '女朋友', '男朋友', '老婆', '老公', '妻子', '丈夫',
    '前任', '前女友', '前男友', '旧爱',
    '复合', '分手', '暧昧', '暗恋', '单恋',
    '表白', '约会', '相亲', '婚恋',
    '缘分', '红鸾', '正缘', '偏缘'
];

function needGender(question) {
    return GENDER_REQUIRED_KEYWORDS.some(keyword =>
        question.includes(keyword)
    );
}

// ============ 解析手动输入的爻象 ============
function parseManualLines(lineStrings) {
    const manualLines = [];

    lineStrings.forEach((item) => {
        let nature = '阳';
        let isOld = false;

        const clean = item.replace(/[，、\s]/g, '');
        if (clean === '老阳' || clean === '动阳' || clean === '阳动' || clean === '○') {
            nature = '阳';
            isOld = true;
        } else if (clean === '老阴' || clean === '动阴' || clean === '阴动' || clean === '×') {
            nature = '阴';
            isOld = true;
        } else if (clean === '阳' || clean === '少阳' || clean === '静阳') {
            nature = '阳';
            isOld = false;
        } else if (clean === '阴' || clean === '少阴' || clean === '静阴') {
            nature = '阴';
            isOld = false;
        } else {
            const num = parseInt(clean);
            if (!isNaN(num)) {
                nature = num === 1 ? '阳' : '阴';
                isOld = false;
            } else {
                nature = '阳';
                isOld = false;
            }
        }

        manualLines.push({
            nature: nature,
            is_old: isOld
        });
    });

    return manualLines;
}

// ============ 随机生成六爻 ============
function generateRandomLines() {
    const lines = [];
    const old_lines = [];
    for (let i = 0; i < 6; i++) {
        lines.push(Math.random() < 0.5 ? 0 : 1);
        old_lines.push(Math.random() < 0.125 ? 1 : 0);
    }
    return { lines, old_lines };
}

// ================================================================
// 调用远程 PHP 桥接（线上版本）
// ================================================================
async function callPHPBridge(inputData) {
    const API_URL = 'https://www.yixiangqiankun.com/yxqk_mcp/index.php';
    const API_KEY = process.env.YIXIANG_API_KEY || 'sk_yixiang_platform_test';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify(inputData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        throw new Error(`远程排盘服务调用失败: ${error.message}`);
    }
}

// ================================================================
// 工具执行函数
// ================================================================
async function executeDivination(args) {
    let lines = args.lines;
    let old_lines = args.old_lines;
    let method = args.method || 'auto';

    if (method === 'manual' && args.manual_lines) {
        const parsed = parseManualLines(args.manual_lines);
        lines = parsed.map(l => l.nature === '阳' ? 1 : 0);
        old_lines = parsed.map(l => l.is_old ? 1 : 0);
    }

    if (!lines || lines.length !== 6) {
        const random = generateRandomLines();
        lines = random.lines;
        old_lines = random.old_lines;
        method = 'auto';
    }

    if (!old_lines || old_lines.length !== 6) {
        old_lines = [0, 0, 0, 0, 0, 0];
    }

    if (needGender(args.question) && !args.gender) {
        return {
            content: [{
                type: 'text',
                text: '⚠️ 检测到感情类问题，请问您的性别是？（男/女）'
            }]
        };
    }

    const bridgeData = {
        question: args.question || '未指定问题',
        method: method,
        lines: lines,
        old_lines: old_lines,
        casting_time: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    if (args.gender) {
        bridgeData.gender = args.gender;
    }

    const result = await callPHPBridge(bridgeData);

    if (!result.success) {
        throw new Error(result.error || '排盘计算失败');
    }

    let content = '';

    if (result.full_prompt) {
        content = result.full_prompt;
    } else {
        content = `📜 排盘完成\n问题：${args.question || '未指定'}`;
        if (result.gua_data && result.gua_data.summary) {
            content += `\n${result.gua_data.summary}`;
        }
        content += '\n\n📱 数据支持：易象乾坤 · 六爻排盘';
    }

    return {
        content: [{ type: 'text', text: content }]
    };
}

// ================================================================
// 手动处理 JSON-RPC 请求（不依赖 SDK 的请求处理器）
// ================================================================
async function handleRequest(request) {
    const { method, params, id } = request;

    try {
        // 处理 tools/list
        if (method === 'tools/list') {
            return {
                jsonrpc: '2.0',
                id,
                result: { tools: TOOLS }
            };
        }

        // 处理 tools/call
        if (method === 'tools/call') {
            const { name, arguments: args } = params;
            if (name !== 'liuyao_divination') {
                throw new Error(`未知工具: ${name}`);
            }
            const result = await executeDivination(args);
            return {
                jsonrpc: '2.0',
                id,
                result: result
            };
        }

        // 处理 initialize
        if (method === 'initialize') {
            return {
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: { listChanged: false } },
                    serverInfo: {
                        name: 'yixiangqiankun-mcp',
                        version: '1.0.0'
                    }
                }
            };
        }

        // 其他方法
        return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
        };
    } catch (error) {
        return {
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message: error.message }
        };
    }
}

// ================================================================
// 创建 MCP Server
// ================================================================
function createMcpServer() {
    const server = new Server(
        {
            name: 'yixiangqiankun-mcp',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    // 使用 server.setRequestHandler 处理 tools/list
    // 注意：这里使用字符串作为 method 名
    server.setRequestHandler('tools/list', async () => {
        return { tools: TOOLS };
    });

    server.setRequestHandler('tools/call', async (request) => {
        const { name, arguments: args } = request.params;
        if (name !== 'liuyao_divination') {
            throw new Error(`未知工具: ${name}`);
        }
        return await executeDivination(args);
    });

    return server;
}

// ================================================================
// 主入口
// ================================================================
async function main() {
    const args = process.argv.slice(2);
    const isSSE = args.includes('--sse') || args.includes('--sse-port');

    if (isSSE) {
        const port = parseInt(process.env.PORT || '3000', 10);
        const app = express();
        app.use(cors());
        app.use(express.json());

        let transports = {};

        app.get('/sse', async (req, res) => {
            const server = createMcpServer();
            const transport = new SSEServerTransport('/message', res);
            transports[transport.sessionId] = transport;

            res.on('close', () => {
                delete transports[transport.sessionId];
            });

            await server.connect(transport);
        });

        app.post('/message', async (req, res) => {
            const sessionId = req.query.sessionId;
            const transport = transports[sessionId];

            if (transport) {
                await transport.handlePostMessage(req, res);
            } else {
                res.status(400).send('No transport available');
            }
        });

        app.get('/health', (req, res) => {
            res.json({ status: 'ok', mode: 'sse' });
        });

        app.listen(port, '0.0.0.0', () => {
            console.error(`SSE MCP Server running on port ${port}`);
            console.error(`SSE endpoint: http://0.0.0.0:${port}/sse`);
            console.error(`Health check: http://0.0.0.0:${port}/health`);
        });

    } else {
        // ============ stdio 模式：使用原始 handleRequest ============
        // 直接处理 stdin/stdout，不依赖 SDK 的 setRequestHandler
        let buffer = '';
        
        process.stdin.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const request = JSON.parse(line);
                    handleRequest(request).then(response => {
                        process.stdout.write(JSON.stringify(response) + '\n');
                    }).catch(err => {
                        process.stderr.write(`Error: ${err.message}\n`);
                    });
                } catch (e) {
                    process.stderr.write(`Invalid JSON: ${line}\n`);
                }
            }
        });

        process.stdin.on('end', () => {
            if (buffer.trim()) {
                try {
                    const request = JSON.parse(buffer);
                    handleRequest(request).then(response => {
                        process.stdout.write(JSON.stringify(response) + '\n');
                    });
                } catch (e) {}
            }
        });

        console.error('Stdio MCP Server running');
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});