#!/bin/bash
file=0;
for file in ./*
do
  echo ""
  echo "*****************$file*****************";
  echo ""
  echo ""

  nodef "$file";
done
