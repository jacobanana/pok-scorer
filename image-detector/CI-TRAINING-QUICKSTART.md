# CI Training Quick Start

Get your POK detector trained in 5 minutes!

## 🚀 Quick Setup

### 1. Annotate Images (5 min)

```bash
# Open annotation editor in browser
open image-detector/annotation-editor.html

# 1. Click "Add Images" → select 20-30 game photos
# 2. Click on poks to annotate (red → blue → delete)
# 3. Click "Download Dataset" → save as pok-training.json
```

### 2. Organize Files (1 min)

```bash
# Create directory structure
mkdir -p image-detector/datasets/images

# Move images
mv ~/Downloads/game*.jpg image-detector/datasets/images/

# Move dataset JSON
mv ~/Downloads/pok-training.json image-detector/datasets/
```

### 3. Commit & Push (1 min)

```bash
git add image-detector/datasets/
git commit -m "Add POK training dataset"
git push
```

✅ **Done!** Training starts automatically in GitHub Actions.

## 📊 Monitor Progress

1. Go to GitHub repository → **Actions** tab
2. Click on **"Train POK Detector"** workflow
3. Watch live logs (~10-15 min)

## 🎯 Use Trained Model

After training completes:

1. **Automatically deployed** to your detector app
2. Open `image-detector/index.html` → parameters auto-loaded
3. Or download from: `image-detector/models/detector-params.json`

## 🔄 Retrain Anytime

Just update `image-detector/datasets/` and push:

```bash
# Add more images
cp new-game-photos/* image-detector/datasets/images/

# Update dataset JSON in annotation editor
# Export and replace pok-training.json

git add image-detector/datasets/
git commit -m "Add 10 more training images"
git push
```

## 🛠️ Manual Trigger

Don't want to push? Trigger manually:

1. **Actions** tab → **Train POK Detector**
2. Click **"Run workflow"**
3. Set parameters:
   - Dataset: `image-detector/datasets/pok-training.json`
   - Iterations: `500`
4. Click **"Run workflow"**

## 📈 Expected Results

With 30 images, 500 iterations:
- **F1 Score**: 75-85%
- **Color Accuracy**: 85-95%
- **Training Time**: 10-15 minutes
- **Cost**: ~$0.08 (private repos), Free (public repos)

## ❓ Troubleshooting

### Training fails with "Dataset not found"
- Verify path: `image-detector/datasets/pok-training.json`
- Check filename matches exactly

### Low accuracy (< 70%)
- Add more diverse images (lighting, angles)
- Increase iterations to 1000
- Check annotation accuracy

### Images not found
- Ensure images are in `image-detector/datasets/images/`
- Filenames in JSON must match actual files

## 📚 Full Documentation

- [README-TRAINING.md](README-TRAINING.md) - Complete training guide
- [datasets/README.md](datasets/README.md) - Dataset creation guide
- [PLAN.md](PLAN.md) - System architecture

## 🤝 Support

Issues? Open a GitHub issue or check workflow logs for error details.
