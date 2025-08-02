
import os
import zipfile
import glob

def unzip_and_remove(directory):
    """
    Unzips all .zip files in a directory and deletes the original .zip file.
    Args:
        directory (str): The path to the directory containing the .zip files.
    """
    for item in glob.glob(os.path.join(directory, '*.zip')):
        if zipfile.is_zipfile(item):
            with zipfile.ZipFile(item, 'r') as zip_ref:
                zip_ref.extractall(directory)
                print(f"Extracted {item}")
            os.remove(item)
            print(f"Deleted {item}")

if __name__ == "__main__":
    base = os.path.dirname(os.path.abspath(__file__))
    subdirs = [
        os.path.join(base, 'congressional_districts_zips'),
        os.path.join(base, 'state_leg_lower_zips'),
        os.path.join(base, 'state_leg_upper_zips'),
    ]
    for subdir in subdirs:
        if os.path.isdir(subdir):
            unzip_and_remove(subdir)
