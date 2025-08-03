
# GPU-accelerated multi-label bill topic classifier using Hugging Face Transformers and PyTorch
import json
import os
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification, Trainer, TrainingArguments
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.metrics import classification_report
import numpy as np

def load_bills(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def extract_text_and_labels(bills):
    texts = []
    labels = []
    for bill in bills:
        abstracts = ''
        if 'abstracts' in bill and isinstance(bill['abstracts'], list):
            abstracts = ' '.join([
                a.get('abstract', '') if isinstance(a, dict) else str(a)
                for a in bill['abstracts']
            ])
        text = ' '.join([
            str(bill.get('title', '')),
            str(bill.get('summary', '')),
            str(bill.get('description', '')),
            str(bill.get('body', '')),
            str(bill.get('full_text', '')),
            str(bill.get('geminiSummary', '')),
            abstracts
        ])
        topics = bill.get('subjects') or bill.get('subject') or bill.get('topics') or bill.get('labels') or []
        if isinstance(topics, str):
            topics = [topics]
        elif not isinstance(topics, list):
            topics = list(topics)
        texts.append(text)
        labels.append(topics)
    return texts, labels

class BillDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length=256):
        self.encodings = tokenizer(texts, truncation=True, padding=True, max_length=max_length)
        self.labels = labels
    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item['labels'] = torch.tensor(self.labels[idx], dtype=torch.float)
        return item
    def __len__(self):
        return len(self.labels)

def compute_metrics(pred):
    y_true = pred.label_ids
    y_pred = (pred.predictions > 0.5).astype(int)
    return {
        'micro_f1': (2 * (y_true & y_pred).sum() / ((y_true + y_pred).sum() + 1e-8)),
    }

def main():
    train_path = os.path.join(os.path.dirname(__file__), 'legislation2.json')
    val_path = os.path.join(os.path.dirname(__file__), 'legislation1.json')
    print('Loading data...')
    train_bills = load_bills(train_path)
    val_bills = load_bills(val_path)

    print('Extracting text and labels...')
    X_train_texts, y_train = extract_text_and_labels(train_bills)
    X_val_texts, y_val = extract_text_and_labels(val_bills)

    print('Binarizing labels...')
    mlb = MultiLabelBinarizer()
    y_train_bin = mlb.fit_transform(y_train)
    y_val_bin = mlb.transform(y_val)

    print('Tokenizing...')
    tokenizer = DistilBertTokenizerFast.from_pretrained('distilbert-base-uncased')
    train_dataset = BillDataset(X_train_texts, y_train_bin, tokenizer)
    val_dataset = BillDataset(X_val_texts, y_val_bin, tokenizer)

    print('Setting up model...')
    model = DistilBertForSequenceClassification.from_pretrained(
        'distilbert-base-uncased',
        num_labels=y_train_bin.shape[1],
        problem_type='multi_label_classification'
    )

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.to(device)

    training_args = TrainingArguments(
        output_dir='./results',
        num_train_epochs=2,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        evaluation_strategy='epoch',
        save_strategy='no',
        logging_dir='./logs',
        logging_steps=50,
        report_to=[]
    )

    print('Training...')
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
    )
    trainer.train()

    print('Evaluating...')
    preds = trainer.predict(val_dataset)
    y_pred_bin = (preds.predictions > 0.5).astype(int)
    print(classification_report(y_val_bin, y_pred_bin, target_names=mlb.classes_))

    print('Saving model and tokenizer...')
    model.save_pretrained('./bill_label_transformer_model')
    tokenizer.save_pretrained('./bill_label_transformer_model')
    with open('bill_label_mlb.json', 'w') as f:
        json.dump(mlb.classes_.tolist(), f)
    print('Done.')

if __name__ == '__main__':
    main()
