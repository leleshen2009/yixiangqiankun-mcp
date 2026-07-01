# 易象乾坤 · 六爻排盘 MCP 服务

基于火珠林法六爻理论和《增删卜易》体系的智能排盘工具，为 AI 助手提供专业的六爻占卜排盘能力。

[![MCP](https://img.shields.io/badge/MCP-Protocol-blue)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

## 📖 目录

- [功能特点](#-功能特点)
- [在线体验](#-在线体验)
- [快速开始](#-快速开始)
  - [前置要求](#前置要求)
  - [安装步骤](#安装步骤)
  - [获取 API Key](#获取-api-key)
- [各平台配置指南](#-各平台配置指南)
  - [Claude Desktop](#claude-desktop)
  - [Cline (VS Code)](#cline-vs-code)
  - [LobeChat](#lobechat)
  - [其他 MCP 客户端](#其他-mcp-客户端)
- [使用示例](#-使用示例)
- [排盘输出示例](#-排盘输出示例)
- [数据安全](#-数据安全)
- [常见问题](#-常见问题)
- [许可证](#-许可证)

---

## ✨ 功能特点

| 功能 | 说明 |
|------|------|
| **自动起卦** | 系统自动模拟六爻摇卦，用户只需说出问题 |
| **完整排盘** | 本卦、变卦、世应、六亲、六兽、纳甲等完整信息 |
| **格局分析** | 自动识别三合局、六冲、六合、游魂、归魂、反吟、伏吟等特殊格局 |
| **专业解读** | 内置六爻专家级解读指令，AI 可直接生成专业解读 |
| **多平台支持** | 兼容 Claude Desktop、Cline、LobeChat 等主流 MCP 客户端 |
| **远程计算** | 排盘算法在云端服务器运行，用户端无需安装 PHP 环境 |

## 🌐 在线体验

访问 [易象乾坤六爻排盘工具](https://www.yixiangqiankun.com/bagua-tools/liuyao) 在线体验排盘功能。

## 🚀 快速开始

### 前置要求

| 要求 | 说明 |
|------|------|
| **Node.js** | 18.0 或更高版本 |
| **网络** | 需要能够访问 `www.yixiangqiankun.com` |
| **API Key** | 从 [易象乾坤](https://www.yixiangqiankun.com) 获取 |

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/你的用户名/yixiangqiankun-mcp.git
cd yixiangqiankun-mcp

# 2. 安装依赖（无需额外依赖，但建议初始化）
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key