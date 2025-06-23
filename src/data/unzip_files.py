import os
import zipfile
import glob

def unzip_and_remove(directory):
    """
    Unzips all .zip files in a directory and removes the original .zip file.

    Args:
        directory (str): The path to the directory containing the .zip files.
    """
    for item in glob.glob(os.path.join(directory, '*.zip')):
        if zipfile.is_zipfile(item):
            with zipfile.ZipFile(item, 'r') as zip_ref:
                zip_ref.extractall(directory)
                print(f"Extracted {item}")
            os.remove(item)
            print(f"Removed {item}")

if __name__ == "__main__":
    unzip_and_remove(os.path.dirname(os.path.abspath(__file__)))
