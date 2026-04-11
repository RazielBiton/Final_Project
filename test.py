import requests

def find_actual_consumer_price():
    # חיפוש כל המאגרים שקשורים לדלק
    search_url = "https://data.gov.il/api/3/action/package_search"
    res = requests.get(search_url, params={'q': 'מחירי דלק'}).json()
    
    # נעבור על כל ה-Resources הקיימים עד שנמצא אחד עם מחיר "הגיוני"
    for package in res['result']['results']:
        for resource in package['resources']:
            r_id = resource['id']
            try:
                data_url = "https://data.gov.il/api/3/action/datastore_search"
                # נשלוף דגימה מהמאגר
                sample = requests.get(data_url, params={'resource_id': r_id, 'limit': 5}).json()
                records = sample['result']['records']
                
                for rec in records:
                    # מחפשים שדה שיש בו ערך בין 6 ל-10 (מחיר לליטר בשקלים)
                    for key, value in rec.items():
                        try:
                            val = float(value)
                            if 6 < val < 10:
                                print(f"🎯 נמצא המאגר הנכון! Resource ID: {r_id}")
                                print(f"⛽ מוצר: {rec.get('מוצר', rec.get('Description', 'בנזין 95'))}")
                                print(f"💰 מחיר לליטר: {val} ש\"ח")
                                return r_id
                        except:
                            continue
            except:
                continue
    print("לא נמצא מאגר עם מחיר לליטר בודד.")

if __name__ == "__main__":
    find_actual_consumer_price()