import os
from PIL import Image

def remove_background(image_path):
    print(f"Processing {image_path}...")
    if not os.path.exists(image_path):
        print(f"File not found: {image_path}")
        return

    try:
        img = Image.open(image_path).convert("RGBA")
        data = img.getdata()

        # Get background color from top-left pixel (0,0)
        bg_color = data[0]
        r_bg, g_bg, b_bg, a_bg = bg_color
        print(f"Detected background color (0,0): R={r_bg}, G={g_bg}, B={b_bg}, A={a_bg}")

        tolerance = 40
        new_data = []
        removed_count = 0

        for item in data:
            r, g, b, a = item
            # If color is close to the background color, make it transparent
            if abs(r - r_bg) < tolerance and abs(g - g_bg) < tolerance and abs(b - b_bg) < tolerance:
                new_data.append((0, 0, 0, 0))
                removed_count += 1
            else:
                new_data.append(item)

        img.putdata(new_data)
        img.save(image_path, "PNG")
        print(f"Saved cleaned image to {image_path}. Removed {removed_count} pixels of background.")
    except Exception as e:
        print(f"Error processing {image_path}: {e}")

if __name__ == "__main__":
    base_dir = r"c:\Users\crisf\Downloads\Two to One - 1.0\Two to One - 1.0\game-metades-main\game-metades-main"
    enemy_dir = os.path.join(base_dir, "Sprites_Inimigos_Luxar")
    
    remove_background(os.path.join(enemy_dir, "frame_1.png"))
    remove_background(os.path.join(enemy_dir, "frame_19.png"))
