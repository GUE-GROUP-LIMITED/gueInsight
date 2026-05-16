with open('frontend/src/pages/Subscription.jsx', 'r') as f:
    lines = f.readlines()

# Fix the structure
output = []
i = 0
while i < len(lines):
    if i == 117:  # The </Link> line
        output.append(lines[i])  # Add the </Link> line
        i += 1
        # Add the corrected closing structure
        output.append('\t\t\t\t\t)\n')
        output.append('\t\t\t\t}\n')
        output.append('\t\t\t</article>\n')
        output.append(lines[i])  # Add the ))} line
        i += 2  # Skip the old </article> and ))} lines
    else:
        output.append(lines[i])
        i += 1

with open('frontend/src/pages/Subscription.jsx', 'w') as f:
    f.writelines(output)

print('Fixed!')
