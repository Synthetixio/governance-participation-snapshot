import json
import csv
import sys
import math

output = []

with open(sys.argv[1]) as fle:
    f = csv.DictReader(fle)
    for line in f:
        if float(line['allocatedRewards']) > 0:
            obj = {}
            obj['address'] = line['address']
            # convert to string to match js merkle code's expected format
            obj['earnings'] = str("{:.0f}".format(float(line['allocatedRewards']) * pow(10,18)))
            obj['reasons'] = 'Ambassador Delegation'

            output.append(obj)

dump = json.dumps(output)

with open(sys.argv[2] + '.json', 'w') as fle:
    fle.write(dump)
