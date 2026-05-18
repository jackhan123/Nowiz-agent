# Git 版本控制指南

## 初始化 Git 仓库

```bash
# 进入项目目录
cd /Users/wangmeng/Desktop/Newiz

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 创建第一个提交
git commit -m "初始版本：两栏式布局"
```

## 日常使用

### 1. 查看当前状态
```bash
git status
```

### 2. 查看提交历史
```bash
git log --oneline
```

### 3. 创建新提交
```bash
# 添加修改的文件
git add hardware-lab-dual.html

# 提交
git commit -m "更新：改进对话式引导"
```

## 版本回退

### 方法 1：回退到上一个版本（保留修改）
```bash
# 查看提交历史
git log --oneline

# 回退到上一个版本（保留工作区修改）
git reset --soft HEAD~1

# 或回退到指定提交（保留工作区修改）
git reset --soft <commit-hash>
```

### 方法 2：回退到上一个版本（丢弃修改）
```bash
# 回退到上一个版本（丢弃工作区修改）
git reset --hard HEAD~1

# 或回退到指定提交（丢弃工作区修改）
git reset --hard <commit-hash>
```

### 方法 3：查看旧版本文件
```bash
# 查看某个提交的文件内容
git show <commit-hash>:hardware-lab-dual.html

# 恢复某个文件的旧版本
git checkout <commit-hash> -- hardware-lab-dual.html
```

### 方法 4：创建新分支（推荐）
```bash
# 创建并切换到新分支
git checkout -b backup-branch

# 在新分支上工作，不影响主分支
# 需要时切换回主分支
git checkout main
```

## 常用命令

```bash
# 查看所有分支
git branch

# 查看文件修改差异
git diff

# 查看某个文件的修改历史
git log -- hardware-lab-dual.html

# 撤销工作区的修改（未提交的）
git checkout -- hardware-lab-dual.html

# 撤销已暂存的修改
git reset HEAD hardware-lab-dual.html
```

## 示例：回退到之前的版本

```bash
# 1. 查看提交历史
git log --oneline
# 输出：
# abc123 最新版本：两栏式布局
# def456 对话式引导改进
# ghi789 初始版本

# 2. 回退到"初始版本"
git reset --hard ghi789

# 3. 如果想恢复最新版本
git reset --hard abc123
```

## 注意事项

⚠️ **重要**：
- `git reset --hard` 会**永久删除**未提交的修改
- 回退前建议先备份或创建新分支
- 如果已经推送到远程仓库，回退后需要强制推送（谨慎使用）

## 推荐工作流程

1. **每次修改前创建提交**
   ```bash
   git add .
   git commit -m "描述你的修改"
   ```

2. **重要修改前创建分支**
   ```bash
   git checkout -b feature/new-feature
   # 进行修改
   git add .
   git commit -m "新功能"
   ```

3. **需要回退时**
   ```bash
   git log --oneline  # 查看历史
   git reset --hard <commit-hash>  # 回退
   ```
