# POK Detector Training Datasets

This directory contains training and validation datasets for the POK detector.

## Directory Structure

```
datasets/
├── README.md                    ← This file
├── images/                      ← Training images
│   ├── game1.jpg
│   ├── game2.jpg
│   └── ...
├── pok-training.json           ← Main training dataset (you create this)
└── pok-test.json               ← Optional test dataset
```

## Creating a Dataset

### Step 1: Capture Images

Take photos of POK games with:
- Different lighting conditions (indoor, outdoor, mixed)
- Different camera angles (30°, 45°, 60° from table)
- Different distances (1-3 meters)
- Different table types (wood, plastic, metal)
- Clear, in-focus shots

**Recommended:**
- Minimum: 20-30 images for basic training
- Production: 50-100 images for robust detection
- Resolution: 1280x720 or higher

### Step 2: Annotate with Browser Tool

1. Open `annotation-editor.html` in your browser
2. Click **"Add Images"** and select your photos
3. Annotate each pok:
   - Click to add red pok
   - Click again to cycle: red → blue → delete
   - Shift+drag to move
   - Ctrl+drag to resize
4. Verify annotations are accurate
5. Click **"Download Dataset"** to save JSON

### Step 3: Organize Files

```bash
# Place images in datasets/images/
cp ~/Downloads/game*.jpg image-detector/datasets/images/

# Place dataset JSON in datasets/
cp ~/Downloads/pok-dataset.json image-detector/datasets/pok-training.json
```

### Step 4: Commit and Train

```bash
git add image-detector/datasets/
git commit -m "Add training dataset with 30 images"
git push
```

Training will automatically start in GitHub Actions!

## Dataset Format

### JSON Schema (v1.0)

```json
{
  "version": "1.0",
  "name": "My POK Dataset",
  "description": "Training data for indoor games",
  "images": [
    {
      "filename": "game1.jpg",
      "width": 1920,
      "height": 1080,
      "notes": "Optional notes about this image",
      "poks": [
        {
          "x": 450,
          "y": 320,
          "radius": 28,
          "color": "red"
        },
        {
          "x": 890,
          "y": 290,
          "radius": 27,
          "color": "blue"
        }
      ]
    }
  ]
}
```

### Field Descriptions

- `version`: Always "1.0"
- `name`: Human-readable dataset name
- `description`: Optional description
- `images[].filename`: Must match file in `images/` directory
- `images[].width`: Image width in pixels
- `images[].height`: Image height in pixels
- `images[].poks[]`: Array of pok annotations
  - `x`, `y`: Center coordinates in pixels
  - `radius`: Circle radius in pixels
  - `color`: Either "red" or "blue"

## Example Datasets

See `example-dataset.json` for a template showing the expected format.

## Best Practices

### Image Quality
✅ **Good:**
- Well-lit, minimal shadows
- Sharp focus on poks
- Stable camera (no motion blur)
- Clear distinction between red and blue poks
- Table fully visible in frame

❌ **Avoid:**
- Extreme backlighting
- Heavy shadows on poks
- Blurry or out-of-focus images
- Partial table views
- Damaged or faded poks

### Annotation Accuracy
- Center annotations precisely on pok centers
- Adjust radius to match visible pok size
- Double-check color labels (red vs blue)
- Remove any incorrect annotations before export

### Dataset Diversity
To train a robust detector, include variety:
- ✅ Multiple table types
- ✅ Different lighting conditions
- ✅ Various camera angles
- ✅ Different pok counts (sparse and dense)
- ✅ Edge cases (poks near table edge, overlapping)

## Data Augmentation

The training pipeline automatically applies augmentation:
- Random brightness/contrast
- Small rotations
- Gaussian noise

You don't need to manually create augmented versions!

## Splitting Train/Val/Test

The training script automatically splits your dataset:
- **Training set**: 70% (used for optimization)
- **Validation set**: 30% (used for evaluation)

For best results, provide at least:
- 15+ images for training (70%)
- 5+ images for validation (30%)

## Git LFS (Large Files)

If your image directory exceeds 100MB, use Git LFS:

```bash
# Install Git LFS
git lfs install

# Track image files
git lfs track "image-detector/datasets/images/*.jpg"
git lfs track "image-detector/datasets/images/*.png"

# Commit .gitattributes
git add .gitattributes
git commit -m "Configure Git LFS for images"
```

## Privacy & Licensing

⚠️ **Important:** Only commit images you have permission to share.

If your repository is public:
- Ensure images don't contain identifiable people
- Don't include copyrighted material
- Add LICENSE file specifying usage terms

## Troubleshooting

### Issue: "Image not found" during training

**Solution:**
- Verify filename in JSON matches actual file in `images/`
- Check case sensitivity (Game1.jpg ≠ game1.jpg)
- Ensure images/ is in the same directory as the JSON

### Issue: Training fails with "No images found"

**Solution:**
- Check that `images/` directory exists
- Verify files have .jpg, .jpeg, or .png extensions
- Run: `ls -la image-detector/datasets/images/`

### Issue: Low accuracy on validation set

**Solutions:**
- Add more diverse training images
- Verify annotations are accurate (re-check in annotation editor)
- Increase training iterations (default: 500, try 1000)

## Next Steps

After creating your dataset:
1. Review [README-TRAINING.md](../README-TRAINING.md) for training instructions
2. Trigger CI training via GitHub Actions
3. Monitor training progress in Actions tab
4. Review trained parameters in `models/detector-params.json`
